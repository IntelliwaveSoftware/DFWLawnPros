// Stock photography from Unsplash (free license). Replace with real project photos before launch.
const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`

export const img = {
  hero: u('1600585154340-be6161a56a0c', 2200),
  lawnCare: u('1605117882932-f9e32b03fea9', 1200),
  lawnCloseup: u('1558904541-efa843a96f01', 1600),
  landscaping: u('1557429287-b2e26467fc2b', 1200),
  design: u('1585320806297-9794b3e4eeae', 1200),
  sod: u('1592595896551-12b371d546d5', 1200),
  turf: u('1580587771525-78b9dba3b914', 1200),
  irrigation: u('1598902108854-10e335adac99', 1200),
  trees: u('1585938389612-a552a28d6914', 1200),
  hardscape: u('1600047509807-ba8f99d2cdde', 1200),
  planting: u('1622383563227-04401ab4e5ea', 1200),
  soil: u('1611843467160-25afb8df1074', 1200),
  residential: u('1598228723793-52759bba239c', 1400),
  commercial: u('1600563438938-a9a27216b4f5', 1400),
  frontYard: u('1625602812206-5ec545ca1231', 1600),
}

export const unsplash = u
