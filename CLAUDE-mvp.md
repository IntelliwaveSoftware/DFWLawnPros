Product Overview
Build a lead-generation and lead-marketplace platform for landscaping companies.
The platform will:
Generate landscaping service leads from consumers.
Store and manage leads.
Enrich leads using AI.
Score and rank leads.
Match leads with relevant landscaping companies.
Allow landscaping companies to purchase leads.
Capture lead outcomes to create training data for future ML models.
The system should be designed so the MVP can operate primarily with rules and AI enrichment, while the architecture supports future supervised ML models.

PART 1 — MVP
1. Goals
The MVP should prove three things:
Consumers will submit landscaping requests.
Landscaping companies will pay for qualified leads.
The platform can collect the data required to improve lead quality over time.
Do NOT build sophisticated ML in the MVP.
Use a combination of:
Structured lead data
AI/LLM enrichment
Rule-based scoring

2. Consumer Lead Funnel
Create a public-facing website for consumers.
Landing page
The landing page should communicate:
Landscaping services available
Geographic service area
Request a quote / connect with a local landscaping company
Simple call-to-action
Lead form
Collect:
Name
Email
Phone
ZIP/postal code
City
Service requested
Project description
Approximate budget
Desired timeframe
Service options should initially include:
Lawn care
Landscaping
Landscape design
Sod
Artificial turf
Irrigation
Tree/shrub work
Hardscaping/patio
Other
Conditional questions
The form may display additional questions based on service type.
Example:
For landscaping/hardscaping:
Approximate project size
Desired project scope
For lawn care:
Property size
Frequency needed
Keep the initial implementation simple and extensible.
Consent
The form must clearly communicate that submitted information may be shared with relevant landscaping companies for the purpose of responding to the request.
Store the user's consent timestamp with the lead.

3. Lead Database
Create a PostgreSQL database.
Primary entities:
Lead
Fields should include at minimum:
id
created_at
updated_at
name
email
phone
city
state
zip_code
service
budget
timeframe
project_description
source
consent_timestamp
status
score
Lead Enrichment
lead_id
extracted_services
project_type
estimated_project_size
estimated_budget
urgency
intent
ai_summary
enrichment_timestamp
Contractor
id
company_name
contact_name
email
phone
service_area
services
active
created_at
Lead Purchase
id
lead_id
contractor_id
price
purchased_at
status
Lead Outcome
id
lead_id
contractor_id
contacted
appointment_booked
quote_given
won
estimated_job_value
notes
updated_at
Design the schema so additional outcome events can be added later.

4. Internal Lead Dashboard
Create an authenticated administrative dashboard.
Administrators should be able to:
View leads
Search leads
Filter leads
View individual lead details
View AI enrichment
View lead score
Change lead status
View which contractor purchased a lead
View lead outcomes
Lead list should display:
Date
Location
Service
Budget
Timeframe
Score
Status
Contractor/purchase status

5. AI Enrichment
When a lead is submitted, send the project description to an LLM.
The LLM should extract structured information.
Example:
Input:
"Looking to completely redo my backyard this summer. Want a patio, new grass and some plants. Budget is around $15k."
Output:
{
  "services": ["hardscaping", "sod", "landscaping"],
  "project_type": "backyard renovation",
  "project_size": "large",
  "estimated_budget": 15000,
  "urgency": "medium",
  "intent": "high"
}

Store the structured output in the database.
The LLM should NOT be treated as the authoritative source for facts the customer did not provide.
Clearly distinguish:
Customer-provided information
AI-derived information
System-calculated information

6. MVP Lead Scoring
Implement a simple deterministic scoring system.
Example:
Budget > $10,000: +20
Project starts within 30 days: +15
High-value service: +15
Large project: +15
Detailed project description: +10
Phone verified: +10
High purchase intent from AI: +10
Complete contact information: +5
Normalize the result to a 0–100 score.
The scoring system must be implemented in a way that allows the scoring rules to be changed without major code changes.
Do not implement machine-learning-based scoring yet.

7. Contractor Dashboard
Create an authenticated contractor portal.
Contractors should be able to:
Create/manage company profile
Define services offered
Define service area
View available leads
View lead details
Purchase a lead
View purchased leads
Update lead outcomes
Contractor matching should initially use deterministic rules:
Geographic service area
Service offered
Contractor active status
Only show a contractor leads that match their configured criteria.

8. Lead Purchase
Implement a basic lead purchase workflow.
For MVP, the system should support a simple fixed lead price or configurable price.
Example:
Lead price = $50

A lead should become unavailable to other contractors once purchased if the platform is using an exclusive-lead model.
Record:
Contractor
Lead
Price
Purchase timestamp
Payment implementation can initially be simplified if necessary, but the database and business logic should support actual payments.

9. Lead Outcome Tracking
After purchasing a lead, contractors should be able to update:
Contacted
Qualified
Appointment booked
Quote provided
Won
Lost
If won, allow the contractor to enter:
Estimated/actual job value
This information is critical for future ML.

10. Analytics
Create basic administrative analytics:
Number of leads
Leads by service
Leads by geography
Leads by source
Average lead score
Leads sold
Revenue
Conversion rate
Contractor activity
Lead outcomes
Track the complete lifecycle:
Lead generated
→ Enriched
→ Scored
→ Presented
→ Purchased
→ Contacted
→ Quoted
→ Won/Lost


11. Technical Requirements
Preferred architecture:
Frontend:
Next.js / React
Backend:
Python / FastAPI
Database:
PostgreSQL
ML/AI:
Python
scikit-learn
LLM API
Infrastructure:
AWS
Payments:
Stripe or equivalent
Authentication:
Standard secure authentication system
The implementation should prioritize simplicity and maintainability.
Do not introduce unnecessary microservices.
The MVP can be a modular monolith.

12. MVP Non-Goals
Do NOT implement:
Custom-trained language models
Sophisticated ML lead ranking
Automated dynamic lead pricing
Advanced contractor matching
Predictive revenue models
Complex recommendation systems
Large-scale data pipelines
Multi-region marketplace
Mobile applications
These belong to the final product.
