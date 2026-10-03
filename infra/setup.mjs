#!/usr/bin/env node
// One-time AWS setup for continuous deployment (safe to re-run).
//
//   node infra/setup.mjs             check config.json against AWS, then deploy infra/bootstrap.yaml
//   node infra/setup.mjs --dry-run   only show what would be reused or created
//   node infra/setup.mjs --github    also copy the stack outputs into the GitHub environment's variables
//
// Environments: production reads config.json; `--env development` reads config.development.json.
// A config with "access": { "restricted": true } is a private environment (the dev site):
//   --allow-ip auto | 1.2.3.4,5.6.7.0/24   IPv4 addresses that get into the site without a password
//                                            ("auto" = this computer's current public IP). The first run
//                                            defaults to auto; later runs keep the current list.
//   --new-password                          generate a new site password (printed once). The first run
//                                            always creates one; SITE_PASSWORD=… sets your own instead.
//   --new-api-token                         with --github: replace the dev API access token secret
// Private environments' IPs, password hash and API token are never written to this repo (it's public).
//
// Custom domain: "domain": { "names": ["dfwlawnpros.com", "www.dfwlawnpros.com"], "hostedZone": "dfwlawnpros.com" }
// (first name = the site's main address, at most two). Setup finds the Route 53 zone, reuses or requests a
// certificate for the zone and *.zone in us-east-1 (CloudFront's region; one certificate serves every
// environment), adds its DNS validation record and waits for it to be issued. The stack then attaches the
// names to CloudFront and creates their DNS records.
//
// Buckets named in config.json are reused when they already exist in this account and region, and
// created by the stack when they don't. An empty name lets CloudFormation generate one.
// With anthropicWorkspaceId set, it also turns on the account's outbound web identity federation,
// which Claude Platform on AWS needs (a one-time, account-wide setting that is off by default).
// Needs the AWS CLI with admin credentials, and the GitHub CLI (`gh`) for --github.
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flags = new Set(argv)
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
const DRY_RUN = flags.has('--dry-run')
const SET_GITHUB = flags.has('--github')
const ENV = option('--env') ?? 'production'

const configFile = ENV === 'production' ? 'config.json' : `config.${ENV}.json`
const config = JSON.parse(readFileSync(join(here, configFile), 'utf8'))
const { region, stackName, apiStackName, anthropicWorkspaceId = '', github, buckets, domain, access = {} } = config
const OIDC_URL = 'token.actions.githubusercontent.com'
const BUCKET_NAME_RE = /^(?!xn--)(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

class SetupError extends Error {}

/** `quiet: false` streams the command's output (long-running deploys). */
function run(cmd, args, { quiet = true } = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
}

function runOrFail(what, cmd, args, options) {
  try {
    return run(cmd, args, options)
  } catch (e) {
    const detail = e.code === 'ENOENT' ? `${cmd} is not installed` : String(e.stderr || '').trim()
    throw new SetupError(`${what} failed${detail ? `: ${detail}` : ' (see output above)'}`)
  }
}

/** Runs an AWS CLI command and returns parsed JSON, or `{ error }` with the CLI's message. */
function aws(...args) {
  try {
    const out = run('aws', [...args, '--region', region, '--output', 'json'])
    return out.trim() ? JSON.parse(out) : {}
  } catch (e) {
    return { error: String(e.stderr || e.message).trim() }
  }
}

/** The existing bootstrap stack, if any: its status, resources and the parameters it was deployed with. */
function currentStack() {
  const described = aws('cloudformation', 'describe-stacks', '--stack-name', stackName)
  if (described.error) {
    if (/does not exist/.test(described.error)) return null
    throw new SetupError(`Could not read stack ${stackName}: ${described.error}`)
  }
  const stack = described.Stacks[0]
  const resources = aws('cloudformation', 'describe-stack-resources', '--stack-name', stackName)
  if (resources.error) throw new SetupError(resources.error)
  return {
    status: stack.StackStatus,
    resources: new Map(resources.StackResources.map((r) => [r.LogicalResourceId, r.PhysicalResourceId])),
    params: new Map((stack.Parameters ?? []).map((p) => [p.ParameterKey, p.ParameterValue])),
  }
}

/** 'mine' (this account, with its region), 'missing', or 'taken' (another account, or no access). */
function lookupBucket(name) {
  const res = aws('s3api', 'get-bucket-location', '--bucket', name)
  if (!res.error) return { state: 'mine', region: res.LocationConstraint || 'us-east-1' }
  if (/NoSuchBucket/.test(res.error)) return { state: 'missing' }
  if (/AccessDenied|Forbidden/.test(res.error)) return { state: 'taken' }
  throw new SetupError(`Could not check bucket ${name}: ${res.error}`)
}

/**
 * Decides whether the stack creates the bucket or reuses an existing one.
 * A bucket this stack created on an earlier run is still "created" — otherwise re-running would
 * detach it from the stack.
 */
function planBucket(label, name, logicalId, nameParam, stack) {
  if (name && !BUCKET_NAME_RE.test(name)) {
    throw new SetupError(`${label} bucket "${name}" is not a valid S3 bucket name`)
  }
  const owned = stack?.resources.get(logicalId)
  if (owned) {
    const previousName = stack.params.get(nameParam) ?? ''
    if (name && name !== owned) {
      throw new SetupError(
        `${label} bucket was created by this stack as "${owned}". Renaming it isn't supported: ` +
          `set buckets.${label} to "${owned}" or "" in config.json.`,
      )
    }
    return { create: true, name: previousName, actual: owned, note: 'created by this stack earlier' }
  }
  if (!name) return { create: true, name: '', actual: '(name generated by CloudFormation)', note: 'will be created' }

  const found = lookupBucket(name)
  if (found.state === 'missing') return { create: true, name, actual: name, note: 'not found, will be created' }
  if (found.state === 'taken') {
    throw new SetupError(
      `${label} bucket "${name}" exists but not in this AWS account (or you lack access). Bucket names are ` +
        'global, so pick another name, or leave it empty to generate one.',
    )
  }
  if (found.region !== region) {
    throw new SetupError(`${label} bucket "${name}" is in ${found.region}; it must be in ${region} to be reused.`)
  }
  return { create: false, name, actual: name, note: 'found, will be reused' }
}

/** A reused site bucket that already has a policy keeps it; the stack then prints the statement to add. */
function planSitePolicy(site, stack) {
  if (site.create || stack?.resources.has('SiteBucketPolicy')) return true
  const res = aws('s3api', 'get-bucket-policy', '--bucket', site.name)
  if (!res.error) return false
  if (/NoSuchBucketPolicy/.test(res.error)) return true
  throw new SetupError(`Could not read the policy of bucket ${site.name}: ${res.error}`)
}

function planOidc(stack) {
  if (stack?.resources.has('GitHubOidcProvider')) return true
  const res = aws('iam', 'list-open-id-connect-providers')
  if (res.error) throw new SetupError(res.error)
  return !res.OpenIDConnectProviderList.some((p) => p.Arn.endsWith(`/${OIDC_URL}`))
}

/**
 * The subject GitHub puts in this repo's OIDC tokens. Newer repos use immutable subjects that embed the
 * owner and repo IDs (repo:Owner@123/Repo@456), which a role trusting repo:Owner/Repo would reject.
 */
function githubSubjectPrefix() {
  try {
    const res = JSON.parse(run('gh', ['api', `repos/${github.repo}/actions/oidc/customization/sub`]))
    if (res.sub_claim_prefix) return res.sub_claim_prefix
  } catch {
    // gh missing or signed out: fall through to the classic format.
  }
  console.warn(`  (could not read the OIDC subject format from GitHub; assuming repo:${github.repo})`)
  return ''
}

/** Claude Platform on AWS mints an identity token for each request, which needs this account setting. */
function federationEnabled() {
  const res = aws('iam', 'get-outbound-web-identity-federation-info')
  if (!res.error) return true
  if (/FeatureDisabled/.test(res.error)) return false
  throw new SetupError(`Could not check outbound web identity federation: ${res.error}`)
}

// ---------------------------------------------------------------- custom domain

/** ACM certificates for CloudFront must live in us-east-1, whatever region the rest uses. */
function acm(...args) {
  try {
    const out = run('aws', ['acm', ...args, '--region', 'us-east-1', '--output', 'json'])
    return out.trim() ? JSON.parse(out) : {}
  } catch (e) {
    throw new SetupError(`aws acm ${args[0]} failed: ${String(e.stderr || e.message).trim()}`)
  }
}

function findHostedZone(zone) {
  const res = aws('route53', 'list-hosted-zones-by-name', '--dns-name', zone, '--max-items', '1')
  if (res.error) throw new SetupError(`Could not read Route 53 hosted zones: ${res.error}`)
  const hz = res.HostedZones?.[0]
  if (!hz || hz.Name !== `${zone}.` || hz.Config?.PrivateZone) throw new SetupError(`No public Route 53 hosted zone named ${zone}`)
  return hz.Id.replace('/hostedzone/', '')
}

/** An issued (or pending) certificate for zone + *.zone, if one exists. */
function findCertificate(zone) {
  const list = acm('list-certificates', '--certificate-statuses', 'ISSUED', 'PENDING_VALIDATION').CertificateSummaryList ?? []
  for (const c of list.filter((c) => c.DomainName === zone)) {
    const cert = acm('describe-certificate', '--certificate-arn', c.CertificateArn).Certificate
    if (cert.SubjectAlternativeNames?.includes(`*.${zone}`)) return { arn: cert.CertificateArn, status: cert.Status }
  }
  return null
}

/** Requests the certificate if needed, adds its DNS validation record, and waits until it's issued. */
function ensureCertificate(zone, zoneId, found) {
  let arn = found?.arn
  if (!arn) {
    arn = acm('request-certificate', '--domain-name', zone, '--subject-alternative-names', `*.${zone}`, '--validation-method', 'DNS',
      '--idempotency-token', zone.replace(/[^a-z0-9]/gi, '').slice(0, 32)).CertificateArn
    console.log(`Requested certificate for ${zone} and *.${zone}`)
  }
  if (found?.status === 'ISSUED') return arn
  // The validation record (the same one for zone and *.zone) can take a few seconds to appear.
  let record
  for (let i = 0; i < 20 && !record; i++) {
    record = acm('describe-certificate', '--certificate-arn', arn).Certificate.DomainValidationOptions?.find((o) => o.ResourceRecord)?.ResourceRecord
    if (!record) execFileSync('sleep', ['3'])
  }
  if (!record) throw new SetupError('ACM did not provide a DNS validation record; re-run setup in a minute')
  const change = { Changes: [{ Action: 'UPSERT', ResourceRecordSet: { Name: record.Name, Type: record.Type, TTL: 300, ResourceRecords: [{ Value: record.Value }] } }] }
  const res = aws('route53', 'change-resource-record-sets', '--hosted-zone-id', zoneId, '--change-batch', JSON.stringify(change))
  if (res.error) throw new SetupError(`Could not add the certificate validation record: ${res.error}`)
  console.log('Added the certificate validation record; waiting for the certificate to be issued (usually a few minutes)…')
  runOrFail('Waiting for certificate validation', 'aws', ['acm', 'wait', 'certificate-validated', '--certificate-arn', arn, '--region', 'us-east-1'], { quiet: false })
  return arn
}

/** This computer's public IPv4 address, for `--allow-ip auto`. */
async function publicIp() {
  const ip = (await (await fetch('https://checkip.amazonaws.com')).text()).trim()
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new SetupError(`Could not detect this computer's IPv4 address (got "${ip}")`)
  return ip
}

async function resolveAllowedIps(value) {
  const entries = value.split(',').map((s) => s.trim()).filter(Boolean)
  const out = []
  for (const e of entries) out.push(e === 'auto' ? await publicIp() : e)
  for (const e of out) {
    if (!/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(e)) throw new SetupError(`"${e}" is not an IPv4 address or CIDR`)
  }
  return out.join(',')
}

/** The header a browser sends for Basic auth; the stack stores only its SHA-256. */
const basicAuthSha256 = (username, password) =>
  createHash('sha256').update(`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`).digest('hex')

/** Each GitHub environment only accepts deploys from its own branch (production ← main, development ← develop). */
function restrictEnvironmentToBranch(repo, env, branch) {
  runOrFail(`Configuring GitHub environment ${env}`, 'gh', [
    'api', '--method', 'PUT', `repos/${repo}/environments/${env}`, '--silent',
    '-F', 'deployment_branch_policy[protected_branches]=false',
    '-F', 'deployment_branch_policy[custom_branch_policies]=true',
  ])
  const existing = run('gh', ['api', `repos/${repo}/environments/${env}/deployment-branch-policies`, '--jq', '.branch_policies[].name'])
  if (!existing.split('\n').includes(branch)) {
    runOrFail(`Allowing branch ${branch} to deploy to ${env}`, 'gh', [
      'api', '--method', 'POST', `repos/${repo}/environments/${env}/deployment-branch-policies`, '--silent',
      '-f', `name=${branch}`, '-f', 'type=branch',
    ])
  }
  console.log(`  ${env} accepts deploys from branch ${branch} only`)
}

/** Private environments: the API requires this token; it's stored only as a GitHub environment secret. */
function ensureApiAccessToken(repo, env) {
  const secrets = run('gh', ['secret', 'list', '--repo', repo, '--env', env, '--json', 'name', '--jq', '.[].name']).split('\n')
  if (secrets.includes('API_ACCESS_TOKEN') && !flags.has('--new-api-token')) {
    console.log('  API_ACCESS_TOKEN secret already set (use --new-api-token to replace it)')
    return
  }
  runOrFail('Setting API_ACCESS_TOKEN', 'gh', ['secret', 'set', 'API_ACCESS_TOKEN', '--repo', repo, '--env', env, '--body', randomBytes(24).toString('base64url')])
  console.log('  set API_ACCESS_TOKEN (a new random token; the next deploys of both workflows pick it up)')
}

function setGithubVariables(outputs) {
  const repo = github.repo
  const env = github.environment
  restrictEnvironmentToBranch(repo, env, github.branch ?? (env === 'production' ? 'main' : 'develop'))
  if (access.restricted) ensureApiAccessToken(repo, env)
  const vars = {
    AWS_REGION: region,
    AWS_DEPLOY_ROLE_ARN: outputs.DeployRoleArn,
    SAM_ARTIFACTS_BUCKET: outputs.ArtifactsBucketName,
    SITE_BUCKET: outputs.SiteBucketName,
    CLOUDFRONT_DISTRIBUTION_ID: outputs.DistributionId,
    SITE_URL: outputs.SiteUrl,
    API_STACK_NAME: apiStackName,
    ...(anthropicWorkspaceId ? { ANTHROPIC_AWS_WORKSPACE_ID: anthropicWorkspaceId } : {}),
  }
  for (const [name, value] of Object.entries(vars)) {
    runOrFail(`Setting ${name}`, 'gh', ['variable', 'set', name, '--repo', repo, '--env', env, '--body', value])
    console.log(`  set ${name}`)
  }
  console.log(`\nStill to add by hand (secrets): gh secret set DATABASE_URL --repo ${repo} --env ${env}`)
  console.log(`                                  gh secret set ADMIN_EMAIL --repo ${repo} --env ${env}   (optional: first admin)`)
}

async function main() {
  const identity = aws('sts', 'get-caller-identity')
  if (identity.error) throw new SetupError(`AWS CLI is not signed in: ${identity.error}`)
  console.log(`AWS account ${identity.Account}, region ${region}, stack ${stackName}\n`)

  const stack = currentStack()
  if (stack?.status === 'ROLLBACK_COMPLETE') {
    throw new SetupError(
      `Stack ${stackName} failed to create and must be deleted before retrying:\n` +
        `  aws cloudformation delete-stack --region ${region} --stack-name ${stackName}`,
    )
  }

  const site = planBucket('site', buckets.site, 'SiteBucket', 'SiteBucketName', stack)
  const artifacts = planBucket('artifacts', buckets.artifacts, 'ArtifactsBucket', 'ArtifactsBucketName', stack)
  const manageSitePolicy = planSitePolicy(site, stack)
  const createOidc = planOidc(stack)
  if (anthropicWorkspaceId && !/^wrkspc_[A-Za-z0-9]+$/.test(anthropicWorkspaceId)) {
    throw new SetupError(`anthropicWorkspaceId "${anthropicWorkspaceId}" should look like wrkspc_01AbCd…`)
  }
  const federation = anthropicWorkspaceId ? federationEnabled() : null
  const subjectPrefix = githubSubjectPrefix()

  // Custom domain: hosted zone + certificate (looked up now, requested/validated after the dry-run check).
  const names = domain.names ?? []
  let dns = null
  if (names.length) {
    if (names.length > 2) throw new SetupError('domain.names supports at most two names (e.g. the domain and its www.)')
    if (domain.certificateArn) {
      dns = { certificateArn: domain.certificateArn, zoneId: domain.hostedZone ? findHostedZone(domain.hostedZone) : '' }
    } else {
      const zone = domain.hostedZone
      if (!zone) throw new SetupError('domain.hostedZone is required when domain.names is set (or give a certificateArn)')
      const outside = names.filter((n) => n !== zone && !n.endsWith(`.${zone}`))
      if (outside.length) throw new SetupError(`${outside.join(', ')} is not in the ${zone} zone`)
      dns = { zone, zoneId: findHostedZone(zone), cert: findCertificate(zone) }
    }
  }

  // Private environment gate. Values not passed keep their current setting (CloudFormation reuses a
  // parameter's previous value when it isn't supplied), so the password never needs to be readable.
  const gate = {}
  let newPassword = null
  if (access.restricted) {
    const ipArg = option('--allow-ip') ?? (stack ? undefined : 'auto')
    if (ipArg !== undefined) gate.AllowedIps = await resolveAllowedIps(ipArg)
    if (!stack || flags.has('--new-password') || process.env.SITE_PASSWORD) {
      newPassword = process.env.SITE_PASSWORD || randomBytes(12).toString('base64url')
      gate.SiteAuthSha256 = basicAuthSha256(access.username ?? 'dfwlp', newPassword)
    }
  }

  console.log(`  site bucket       ${site.actual} — ${site.note}`)
  console.log(`  artifacts bucket  ${artifacts.actual} — ${artifacts.note}`)
  if (!manageSitePolicy) console.log('  site bucket policy  already exists; you add the CloudFront statement (printed below)')
  console.log(`  GitHub OIDC provider  ${createOidc ? 'managed by this stack' : 'already exists, reused'}`)
  console.log(`  GitHub token subject  ${subjectPrefix || `repo:${github.repo}`}:environment:${github.environment}`)
  if (access.restricted) {
    console.log(`  Site access           private: ${gate.AllowedIps !== undefined ? `IPs ${gate.AllowedIps}` : 'IP list unchanged'}, ${newPassword ? 'new password' : 'password unchanged'}`)
  }
  if (dns) {
    const certNote = dns.certificateArn ? 'given in config' : dns.cert ? `${dns.cert.status.toLowerCase().replace('_', ' ')}, reused` : 'will be requested'
    console.log(`  Custom domain         ${names.join(', ')} → https://${names[0]} (certificate ${certNote}${dns.zoneId ? `, DNS in zone ${dns.zone ?? domain.hostedZone}` : ''})`)
  }
  if (!anthropicWorkspaceId) console.log(`  AI enrichment         off (no anthropicWorkspaceId in ${configFile})`)
  else console.log(`  AI enrichment         workspace ${anthropicWorkspaceId}; outbound identity federation ${federation ? 'already on' : 'will be turned on'}`)
  console.log('')
  if (DRY_RUN) return

  const certificateArn = dns ? (dns.certificateArn ?? ensureCertificate(dns.zone, dns.zoneId, dns.cert)) : ''

  if (federation === false) {
    runOrFail('Enabling outbound web identity federation', 'aws', ['iam', 'enable-outbound-web-identity-federation', '--region', region])
    console.log('Turned on outbound web identity federation for Claude Platform on AWS.\n')
  }

  const params = {
    GitHubRepo: github.repo,
    GitHubEnvironment: github.environment,
    GitHubSubjectPrefix: subjectPrefix,
    ApiStackName: apiStackName,
    CreateOidcProvider: String(createOidc),
    SiteBucketName: site.name,
    CreateSiteBucket: String(site.create),
    ManageSiteBucketPolicy: String(manageSitePolicy),
    ArtifactsBucketName: artifacts.name,
    CreateArtifactsBucket: String(artifacts.create),
    DomainNames: names.join(','),
    CertificateArn: certificateArn,
    HostedZoneId: dns?.zoneId ?? '',
    ...gate,
  }
  runOrFail(
    'Stack deploy',
    'aws',
    [
      'cloudformation', 'deploy',
      '--region', region,
      '--stack-name', stackName,
      '--template-file', join(here, 'bootstrap.yaml'),
      '--capabilities', 'CAPABILITY_IAM',
      '--no-fail-on-empty-changeset',
      '--parameter-overrides', ...Object.entries(params).map(([k, v]) => `${k}=${v}`),
    ],
    { quiet: false },
  )

  const described = aws('cloudformation', 'describe-stacks', '--stack-name', stackName)
  if (described.error) throw new SetupError(described.error)
  const outputs = Object.fromEntries(described.Stacks[0].Outputs.map((o) => [o.OutputKey, o.OutputValue]))
  console.log('\nOutputs:')
  for (const [k, v] of Object.entries(outputs)) if (k !== 'SiteBucketPolicyStatement') console.log(`  ${k.padEnd(20)} ${v}`)
  if (outputs.SiteBucketPolicyStatement) {
    console.log(`\nAdd this statement to the policy of bucket ${site.name} so CloudFront can serve it:`)
    console.log(JSON.stringify(JSON.parse(outputs.SiteBucketPolicyStatement), null, 2))
  }

  if (newPassword) {
    console.log(`\nSite sign-in for visitors outside the allowed IPs (shown once, save it in your password manager):`)
    console.log(`  username: ${access.username ?? 'dfwlp'}\n  password: ${newPassword}`)
  }

  if (SET_GITHUB) {
    console.log(`\nSetting GitHub variables on ${github.repo} (environment ${github.environment}):`)
    setGithubVariables(outputs)
  } else {
    console.log('\nRe-run with --github to copy these into the GitHub environment, or set them by hand (see README).')
  }
}

try {
  await main()
} catch (e) {
  if (!(e instanceof SetupError)) throw e
  console.error(`\n${e.message}`)
  process.exit(1)
}
