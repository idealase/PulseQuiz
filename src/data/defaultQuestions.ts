import { Question } from '../types'

// Question Set Type
export type QuestionSetId = 'general' | 'expert' | 'startup' | 'wines-australia' | 'ai-tech' | 'trash-trivia'

export interface QuestionSet {
  id: QuestionSetId
  name: string
  emoji: string
  description: string
  questions: Question[]
}

// Default quiz questions - General Knowledge Mix
export const generalQuestions: Question[] = [
  {
    question: "What architectural pattern stores immutable events as the source of truth?",
    options: ["Event sourcing", "CQRS", "Lambda architecture", "Write-Only Living"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian city hosts the Melbourne Cup?",
    options: ["Melbourne", "Sydney", "Flemington", "Horsetown"],
    correct: 0,
    points: 1
  },
  {
    question: "What metric penalises large forecast errors more heavily?",
    options: ["Root Mean Squared Error", "Mean Absolute Error", "Mean Squared Error", "Big Error Panic"],
    correct: 0,
    points: 1
  },
  {
    question: "Who released the 2024 album Cowboy Carter?",
    options: ["Beyoncé", "Taylor Swift", "Dolly Parton", "Yeehawoncé"],
    correct: 0,
    points: 1
  },
  {
    question: "What professional services firm is one of the Big Four?",
    options: ["Deloitte", "Accenture", "McKinsey", "Big Accounty Co"],
    correct: 0,
    points: 1
  },
  {
    question: "What does RAG stand for in LLM systems?",
    options: ["Retrieval-Augmented Generation", "Reinforced Auto Generation", "Recurrent Attention Graph", "Really Accurate Guessing"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian animal appears on the one dollar coin?",
    options: ["Kangaroo", "Emu", "Koala", "Drop Bear"],
    correct: 0,
    points: 1
  },
  {
    question: "Who wrote 1984?",
    options: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "Big Brother"],
    correct: 0,
    points: 1
  },
  {
    question: "What bias leads people to over-trust automated systems?",
    options: ["Automation bias", "Confirmation bias", "Overfitting", "Robot Worship"],
    correct: 0,
    points: 1
  },
  {
    question: "What gas primarily drives the greenhouse effect?",
    options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Bad Air"],
    correct: 0,
    points: 1
  },
  {
    question: "What document governs ethical conduct in consulting firms?",
    options: ["Code of conduct", "Statement of work", "Service catalogue", "Vibe Charter"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian body manages monetary policy?",
    options: ["Reserve Bank of Australia", "Treasury", "ASIC", "Money Wizards"],
    correct: 0,
    points: 1
  },
  {
    question: "What file format underpins Delta Lake storage?",
    options: ["Apache Parquet", "CSV", "JSON", "Delta.xls"],
    correct: 0,
    points: 1
  },
  {
    question: "What band released OK Computer?",
    options: ["Radiohead", "Coldplay", "Muse", "The Computers"],
    correct: 0,
    points: 1
  },
  {
    question: "What billing model charges by time worked?",
    options: ["Time and materials", "Fixed price", "Value based pricing", "Clock Farming"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian writer authored Cloudstreet?",
    options: ["Tim Winton", "Peter Carey", "Patrick White", "Steve Irwin"],
    correct: 0,
    points: 1
  },
  {
    question: "What similarity metric is most common for embeddings?",
    options: ["Cosine similarity", "Euclidean distance", "Dot product", "Goodness Score"],
    correct: 0,
    points: 1
  },
  {
    question: "What 2024 global event dominated news coverage?",
    options: ["United States election cycle", "FIFA World Cup", "Olympics", "Everyone Arguing"],
    correct: 0,
    points: 1
  },
  {
    question: "Who proposed the theory of natural selection?",
    options: ["Charles Darwin", "Gregor Mendel", "Isaac Newton", "Monkey Guy"],
    correct: 0,
    points: 1
  },
  {
    question: "What deployment pattern exposes a small fraction of users first?",
    options: ["Canary deployment", "Blue-green deployment", "Rolling deployment", "Sacrifice Release"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian state is abbreviated WA?",
    options: ["Western Australia", "South Australia", "Northern Territory", "West Atlantis"],
    correct: 0,
    points: 1
  },
  {
    question: "What novel begins with \"Call me Ishmael\"?",
    options: ["Moby-Dick", "The Old Man and the Sea", "Heart of Darkness", "Whale Time"],
    correct: 0,
    points: 1
  },
  {
    question: "What document defines scope and deliverables?",
    options: ["Statement of Work", "Code of ethics", "Timesheet", "Pinky Promise"],
    correct: 0,
    points: 1
  },
  {
    question: "What process ensures ML models perform post-deployment?",
    options: ["Model monitoring", "Training", "Prompt tuning", "Watching Nervously"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian holiday occurs on January 26?",
    options: ["Australia Day", "ANZAC Day", "Labour Day", "BBQ Day"],
    correct: 0,
    points: 1
  },
  {
    question: "Who released the album Future Nostalgia?",
    options: ["Dua Lipa", "Lady Gaga", "Charli XCX", "Disco Bot"],
    correct: 0,
    points: 1
  },
  {
    question: "What paradox hides trends in aggregates?",
    options: ["Simpson's paradox", "Survivorship bias", "Regression to the mean", "Math Gaslighting"],
    correct: 0,
    points: 1
  },
  {
    question: "What current trend drives global rate volatility?",
    options: ["Inflation", "Cryptocurrency", "Remote work", "Vibes"],
    correct: 0,
    points: 1
  },
  {
    question: "What animal appears on Australia's coat of arms?",
    options: ["Emu", "Platypus", "Dingo", "Magpie Judge"],
    correct: 0,
    points: 1
  },
  {
    question: "What LLM failure involves fabricated citations?",
    options: ["Hallucination", "Overfitting", "Bias", "Creative Confidence"],
    correct: 0,
    points: 1
  },
  {
    question: "What genre is Sapiens?",
    options: ["Popular science", "Historical fiction", "Philosophy", "Cave Memoir"],
    correct: 0,
    points: 1
  },
  {
    question: "What obligation prevents sharing client data?",
    options: ["Confidentiality", "Transparency", "Portability", "Pinky Lock"],
    correct: 0,
    points: 1
  },
  {
    question: "What city hosted the 2000 Olympics?",
    options: ["Sydney", "Melbourne", "Brisbane", "Olympicland"],
    correct: 0,
    points: 1
  },
  {
    question: "What pattern separates read and write models?",
    options: ["CQRS", "Event sourcing", "Star schema", "Ready-Writey"],
    correct: 0,
    points: 1
  },
  {
    question: "Who released 1989 (Taylor's Version)?",
    options: ["Taylor Swift", "Olivia Rodrigo", "Lana Del Rey", "Taylor Original"],
    correct: 0,
    points: 1
  },
  {
    question: "Who wrote True History of the Kelly Gang?",
    options: ["Peter Carey", "Tim Winton", "Christos Tsiolkas", "Ned Kelly Himself"],
    correct: 0,
    points: 1
  },
  {
    question: "What occurs when model inputs change over time?",
    options: ["Data drift", "Overfitting", "Leakage", "Model Aging"],
    correct: 0,
    points: 1
  },
  {
    question: "What science studies the nervous system?",
    options: ["Neuroscience", "Psychology", "Physiology", "Brain Stuff"],
    correct: 0,
    points: 1
  },
  {
    question: "What pricing model ties fees to outcomes?",
    options: ["Value-based pricing", "Time and materials", "Fixed price", "Good Job Bonus"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian state is called the Sunshine State?",
    options: ["Queensland", "New South Wales", "Western Australia", "Vitamin D Land"],
    correct: 0,
    points: 1
  },
  {
    question: "What attack corrupts training data?",
    options: ["Data poisoning", "Prompt injection", "Model inversion", "Keyboard Sabotage"],
    correct: 0,
    points: 1
  },
  {
    question: "What explains survival of the fittest?",
    options: ["Natural selection", "Lamarckism", "Mutation", "Nature Vibes"],
    correct: 0,
    points: 1
  },
  {
    question: "What regulates Australian financial markets?",
    options: ["ASIC", "APRA", "ASX", "Market Police"],
    correct: 0,
    points: 1
  },
  {
    question: "What governance control requires human approval?",
    options: ["Human-in-the-loop", "Observability", "Logging", "Asking Nicely"],
    correct: 0,
    points: 1
  },
  {
    question: "What epic poem is attributed to Homer?",
    options: ["The Odyssey", "The Iliad", "Metamorphoses", "Greek Stuff"],
    correct: 0,
    points: 1
  },
  {
    question: "What airline uses the kangaroo logo?",
    options: ["Qantas", "Virgin Australia", "Jetstar", "Flyaroo"],
    correct: 0,
    points: 1
  },
  {
    question: "What statistical field models uncertainty?",
    options: ["Bayesian statistics", "Deterministic modelling", "Linear algebra", "Guessology"],
    correct: 0,
    points: 1
  },
  {
    question: "What genre features rhythmic spoken vocals?",
    options: ["Hip-hop", "EDM", "Rock", "Fast Talking Music"],
    correct: 0,
    points: 1
  },
  {
    question: "What document tracks project risks?",
    options: ["Risk register", "Project charter", "Invoice", "Worry List"],
    correct: 0,
    points: 1
  },
  {
    question: "What capital sits on Lake Burley Griffin?",
    options: ["Canberra", "Sydney", "Melbourne", "Capital City"],
    correct: 0,
    points: 1
  },
  {
    question: "What pattern ensures exactly-once processing?",
    options: ["Idempotent processing", "At-least-once delivery", "Transactions", "Say It Only Once"],
    correct: 0,
    points: 1
  },
  {
    question: "What evaluation failure leaks benchmarks into training?",
    options: ["Benchmark contamination", "Overfitting", "Data drift", "Sneaky Studying"],
    correct: 0,
    points: 1
  },
  {
    question: "What consulting risk misaligns incentives?",
    options: ["Moral hazard", "Scope creep", "Conflict of interest", "Getting Paid Anyway"],
    correct: 0,
    points: 1
  },
  {
    question: "What statistical concept explains mean reversion?",
    options: ["Regression to the mean", "Central limit theorem", "Law of large numbers", "Stats Being Rude"],
    correct: 0,
    points: 1
  },
  {
    question: "What principle limits executive power in Australia?",
    options: ["Separation of powers", "Parliamentary sovereignty", "Judicial review", "No Funny Business"],
    correct: 0,
    points: 1
  },
  {
    question: "What ML failure comes from proxy optimisation?",
    options: ["Objective misalignment", "Overfitting", "Bias", "Teaching The Wrong Thing"],
    correct: 0,
    points: 1
  },
  {
    question: "What term describes a story within a story?",
    options: ["Frame narrative", "Metafiction", "Intertextuality", "Inception Writing"],
    correct: 0,
    points: 1
  },
  {
    question: "What isolation level prevents phantom reads?",
    options: ["Serializable isolation", "Repeatable read", "Snapshot isolation", "Ghost Protection"],
    correct: 0,
    points: 1
  },
  {
    question: "What consulting risk expands unpaid work?",
    options: ["Scope creep", "Gold plating", "Change request", "Free Labour"],
    correct: 0,
    points: 1
  },
  {
    question: "What physics principle explains quantum uncertainty?",
    options: ["Heisenberg uncertainty principle", "Wave-particle duality", "Observer effect", "Physics Vibes"],
    correct: 0,
    points: 1
  },
  {
    question: "What alignment failure exploits reward functions?",
    options: ["Specification gaming", "Hallucination", "Prompt injection", "Cheating The Teacher"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian policy prices emissions?",
    options: ["Safeguard Mechanism", "Carbon tax", "Emissions trading", "Pollution Fine Jar"],
    correct: 0,
    points: 1
  },
  {
    question: "What music concept explains tension and release?",
    options: ["Harmonic resolution", "Syncopation", "Modulation", "Musical Blue Balls"],
    correct: 0,
    points: 1
  },
  {
    question: "What analytics failure leaks future labels?",
    options: ["Target leakage", "Overfitting", "Noise", "Seeing The Future"],
    correct: 0,
    points: 1
  },
  {
    question: "What philosophical problem challenges induction?",
    options: ["Problem of induction", "Trolley problem", "Problem of evil", "Why Stuff Happens"],
    correct: 0,
    points: 1
  },
  {
    question: "What artefact aligns stakeholders on value?",
    options: ["Business case", "Project plan", "Roadmap", "Slide Deck Of Hope"],
    correct: 0,
    points: 1
  },
  {
    question: "What AI scaling law balances data and compute?",
    options: ["Chinchilla scaling laws", "Moore's law", "Zipf's law", "Big Computer Go Brr"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian author won two Bookers?",
    options: ["Peter Carey", "Patrick White", "Richard Flanagan", "Booker Collector"],
    correct: 0,
    points: 1
  },
  {
    question: "What process corrects DNA replication errors?",
    options: ["DNA proofreading", "Transcription", "Translation", "Gene Spellcheck"],
    correct: 0,
    points: 1
  },
  {
    question: "What governance risk comes from opaque AI decisions?",
    options: ["Accountability gap", "Bias", "Drift", "Nobody Knows Why"],
    correct: 0,
    points: 1
  }
]

// Expert Trivia - Super challenging questions for only the best trivia-heads
export const expertQuestions: Question[] = [
  {
    question: "In what year did the Byzantine Empire officially fall to the Ottoman Turks?",
    options: ["1453", "1204", "1389", "1492"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the only letter that doesn't appear in any US state name?",
    options: ["Q", "X", "Z", "J"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the Chandrasekhar limit approximately equal to?",
    options: ["1.4 solar masses", "2.8 solar masses", "0.7 solar masses", "3.2 solar masses"],
    correct: 0,
    points: 1
  },
  {
    question: "Which chess opening begins with 1.e4 c5?",
    options: ["Sicilian Defense", "French Defense", "Caro-Kann Defense", "Italian Game"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the only country to have a non-rectangular flag?",
    options: ["Nepal", "Switzerland", "Vatican City", "Japan"],
    correct: 0,
    points: 1
  },
  {
    question: "Who composed 'The Well-Tempered Clavier'?",
    options: ["Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Franz Schubert"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the chemical formula for the mineral pyrite?",
    options: ["FeS₂", "Fe₂O₃", "CuFeS₂", "FeAsS"],
    correct: 0,
    points: 1
  },
  {
    question: "Which author wrote under the pseudonym 'George Eliot'?",
    options: ["Mary Ann Evans", "Charlotte Brontë", "Jane Austen", "Virginia Woolf"],
    correct: 0,
    points: 1
  },
  {
    question: "What theorem states that every even integer > 2 can be expressed as the sum of two primes?",
    options: ["Goldbach's conjecture", "Fermat's Last Theorem", "Riemann Hypothesis", "Twin Prime conjecture"],
    correct: 0,
    points: 1
  },
  {
    question: "In which organ of the body would you find the Islets of Langerhans?",
    options: ["Pancreas", "Liver", "Kidney", "Spleen"],
    correct: 0,
    points: 1
  },
  {
    question: "What ancient wonder was located in the city of Halicarnassus?",
    options: ["Mausoleum at Halicarnassus", "Colossus of Rhodes", "Temple of Artemis", "Lighthouse of Alexandria"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the deepest point in the Earth's oceans?",
    options: ["Challenger Deep", "Puerto Rico Trench", "Java Trench", "Tonga Trench"],
    correct: 0,
    points: 1
  },
  {
    question: "Who painted 'The Garden of Earthly Delights'?",
    options: ["Hieronymus Bosch", "Pieter Bruegel", "Jan van Eyck", "Albrecht Dürer"],
    correct: 0,
    points: 1
  },
  {
    question: "What programming language was created by Bjarne Stroustrup?",
    options: ["C++", "Java", "Python", "C#"],
    correct: 0,
    points: 1
  },
  {
    question: "In Norse mythology, what is the name of the world tree?",
    options: ["Yggdrasil", "Midgard", "Asgard", "Bifrost"],
    correct: 0,
    points: 1
  },
  {
    question: "What particle was discovered at CERN in 2012?",
    options: ["Higgs boson", "Top quark", "W boson", "Graviton"],
    correct: 0,
    points: 1
  },
  {
    question: "Which treaty ended World War I with Germany?",
    options: ["Treaty of Versailles", "Treaty of Trianon", "Treaty of Brest-Litovsk", "Treaty of Saint-Germain"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the capital city of Bhutan?",
    options: ["Thimphu", "Kathmandu", "Vientiane", "Naypyidaw"],
    correct: 0,
    points: 1
  },
  {
    question: "In cryptography, what does RSA stand for?",
    options: ["Rivest-Shamir-Adleman", "Random Secure Algorithm", "Rotating Secret Access", "Recursive Symmetric Arithmetic"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the SI unit of electrical capacitance?",
    options: ["Farad", "Henry", "Ohm", "Coulomb"],
    correct: 0,
    points: 1
  }
]

// Startup Founder Questions - VC, business, and tech state of the art
export const startupQuestions: Question[] = [
  {
    question: "What does 'ARR' stand for in SaaS metrics?",
    options: ["Annual Recurring Revenue", "Average Revenue Rate", "Accumulated Revenue Return", "Annual Revenue Ratio"],
    correct: 0,
    points: 1
  },
  {
    question: "What term describes a startup valued at over $1 billion?",
    options: ["Unicorn", "Decacorn", "Centaur", "Phoenix"],
    correct: 0,
    points: 1
  },
  {
    question: "What funding round typically comes after Series A?",
    options: ["Series B", "Series C", "Growth round", "Bridge round"],
    correct: 0,
    points: 1
  },
  {
    question: "What is a 'SAFE' in startup fundraising?",
    options: ["Simple Agreement for Future Equity", "Standard Asset For Equity", "Secured Advance for Financing Enterprise", "Startup Accelerated Funding Exchange"],
    correct: 0,
    points: 1
  },
  {
    question: "What metric measures the cost to acquire a customer?",
    options: ["CAC", "LTV", "MRR", "NPS"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'PMF' stand for in startup terminology?",
    options: ["Product-Market Fit", "Performance Measurement Framework", "Pre-Money Funding", "Product Management Function"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the typical equity range VCs expect for a Series A?",
    options: ["15-25%", "5-10%", "40-50%", "1-5%"],
    correct: 0,
    points: 1
  },
  {
    question: "What does a '409A valuation' determine?",
    options: ["Fair market value of common stock", "Company revenue projections", "VC ownership percentage", "Employee headcount limits"],
    correct: 0,
    points: 1
  },
  {
    question: "What is 'runway' in startup terms?",
    options: ["Months of cash remaining", "Path to IPO", "Marketing strategy", "Product roadmap timeline"],
    correct: 0,
    points: 1
  },
  {
    question: "What startup accelerator was founded by Paul Graham?",
    options: ["Y Combinator", "Techstars", "500 Startups", "Seedcamp"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'burn rate' measure?",
    options: ["Monthly cash spending", "Customer churn percentage", "Server processing speed", "Employee turnover"],
    correct: 0,
    points: 1
  },
  {
    question: "What is a 'cap table'?",
    options: ["Capitalization table showing ownership", "Customer acquisition targets", "Capital expenditure budget", "Capacity planning tool"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'LTV:CAC ratio' indicate when it's 3:1?",
    options: ["Healthy unit economics", "Poor growth potential", "Over-investment in sales", "Unprofitable customers"],
    correct: 0,
    points: 1
  },
  {
    question: "What is 'dilution' in the context of fundraising?",
    options: ["Reduction in ownership percentage", "Decrease in company valuation", "Loss of voting rights", "Decline in revenue"],
    correct: 0,
    points: 1
  },
  {
    question: "What framework popularized 'Jobs to be Done' theory?",
    options: ["Clayton Christensen", "Eric Ries", "Steve Blank", "Peter Thiel"],
    correct: 0,
    points: 1
  },
  {
    question: "What is a 'down round'?",
    options: ["Funding at lower valuation than previous", "Final funding before IPO", "Emergency bridge financing", "Debt conversion event"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'NRR' measure in SaaS businesses?",
    options: ["Net Revenue Retention", "New Revenue Rate", "Normalized Revenue Ratio", "Net Recurring Revenue"],
    correct: 0,
    points: 1
  },
  {
    question: "What legal structure do most US startups use?",
    options: ["Delaware C-Corp", "LLC", "S-Corp", "B-Corp"],
    correct: 0,
    points: 1
  },
  {
    question: "What is a 'term sheet'?",
    options: ["Non-binding investment offer outlining terms", "Final legal funding agreement", "Employee stock option plan", "Quarterly financial report"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'MVP' stand for in lean startup methodology?",
    options: ["Minimum Viable Product", "Most Valuable Proposition", "Market Validation Process", "Measured Value Performance"],
    correct: 0,
    points: 1
  }
]

// Wines of Australia - grape varieties, regions, and cellar door knowledge
export const winesOfAustraliaQuestions: Question[] = [
  {
    question: "What grape variety is the Barossa Valley most famous for?",
    options: ["Shiraz", "Cabernet Sauvignon", "Chardonnay", "Pinot Noir"],
    correct: 0,
    points: 1
  },
  {
    question: "Which Australian wine region is renowned for its Riesling?",
    options: ["Clare Valley", "Hunter Valley", "Yarra Valley", "Margaret River"],
    correct: 0,
    points: 1
  },
  {
    question: "What is Penfolds Grange's primary grape variety?",
    options: ["Shiraz", "Cabernet Sauvignon", "Merlot", "Grenache"],
    correct: 0,
    points: 1
  },
  {
    question: "Which state is Margaret River located in?",
    options: ["Western Australia", "South Australia", "Victoria", "New South Wales"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian region is called the 'Hunter' and famous for Semillon?",
    options: ["Hunter Valley", "Barossa Valley", "McLaren Vale", "Eden Valley"],
    correct: 0,
    points: 1
  },
  {
    question: "What winemaking technique involves skin contact for white wines?",
    options: ["Orange wine", "Rosé", "Champagne method", "Cold soak"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'terroir' refer to in winemaking?",
    options: ["Environmental conditions that affect grape character", "The barrel aging process", "A type of grape clone", "Wine bottle labelling regulations"],
    correct: 0,
    points: 1
  },
  {
    question: "Which Victorian region is best known for Pinot Noir?",
    options: ["Yarra Valley", "Rutherglen", "King Valley", "Geelong"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the traditional Rutherglen specialty fortified wine?",
    options: ["Muscat", "Port", "Sherry", "Madeira"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'GSM' stand for in Australian wine blends?",
    options: ["Grenache-Shiraz-Mourvèdre", "Gewürztraminer-Sauvignon-Marsanne", "Graciano-Sangiovese-Malbec", "Grüner-Silvaner-Muscat"],
    correct: 0,
    points: 1
  },
  {
    question: "What Australian wine classification is similar to France's Grand Cru?",
    options: ["Langton's Classification", "Heritage Label", "First Growth", "Outstanding Vineyard"],
    correct: 0,
    points: 1
  },
  {
    question: "Which region's Cabernet Sauvignon rivals Bordeaux in reputation?",
    options: ["Coonawarra", "Barossa Valley", "Hunter Valley", "Adelaide Hills"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the distinctive red soil of Coonawarra called?",
    options: ["Terra rossa", "Laterite", "Red clay", "Ironstone"],
    correct: 0,
    points: 1
  },
  {
    question: "What winery produced the first commercial Australian Chardonnay in the 1970s?",
    options: ["Tyrrell's", "Penfolds", "Lindeman's", "Wolf Blass"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'old vine' typically mean for Barossa Shiraz?",
    options: ["Vines over 35 years old", "Vines over 100 years old", "Vines planted before 2000", "Vines from original cuttings only"],
    correct: 0,
    points: 1
  },
  {
    question: "What cool-climate Tasmanian region is gaining fame for sparkling wine?",
    options: ["Tamar Valley", "Huon Valley", "Derwent Valley", "Coal River Valley"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the most planted white grape variety in Australia?",
    options: ["Chardonnay", "Sauvignon Blanc", "Riesling", "Semillon"],
    correct: 0,
    points: 1
  },
  {
    question: "What iconic brand created the Yellow Label Cabernet Sauvignon?",
    options: ["Wolf Blass", "Jacob's Creek", "Penfolds", "Henschke"],
    correct: 0,
    points: 1
  },
  {
    question: "What Adelaide Hills winery is famous for Sauvignon Blanc and 'The Dead Arm' Shiraz?",
    options: ["d'Arenberg", "Shaw + Smith", "Henschke", "Torbreck"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'méthode traditionnelle' mean on an Australian sparkling wine?",
    options: ["Bottle-fermented like Champagne", "Made with Prosecco grapes", "Tank-fermented in bulk", "Naturally carbonated by spring water"],
    correct: 0,
    points: 1
  }
]

// AI Tech & Business Post-2020 - the big moves in artificial intelligence and tech business
export const aiTechQuestions: Question[] = [
  {
    question: "What company released ChatGPT in November 2022?",
    options: ["OpenAI", "Google", "Meta", "Anthropic"],
    correct: 0,
    points: 1
  },
  {
    question: "What architecture underpins most modern large language models?",
    options: ["Transformer", "LSTM", "Convolutional neural network", "Recurrent neural network"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'RLHF' stand for in model training?",
    options: ["Reinforcement Learning from Human Feedback", "Recursive Language Handling Framework", "Retrieval-Linked Hyperparameter Fitting", "Reinforced Latent Hidden Features"],
    correct: 0,
    points: 1
  },
  {
    question: "Which company created the Gemini family of AI models?",
    options: ["Google DeepMind", "OpenAI", "Anthropic", "Meta"],
    correct: 0,
    points: 1
  },
  {
    question: "What GPU maker's stock price surged past $1 trillion due to AI demand?",
    options: ["NVIDIA", "AMD", "Intel", "Qualcomm"],
    correct: 0,
    points: 1
  },
  {
    question: "What technique fine-tunes models using low-rank matrix decomposition?",
    options: ["LoRA", "RLHF", "Distillation", "Quantization"],
    correct: 0,
    points: 1
  },
  {
    question: "What AI company was founded by ex-OpenAI researchers including Dario Amodei?",
    options: ["Anthropic", "Cohere", "Stability AI", "Mistral"],
    correct: 0,
    points: 1
  },
  {
    question: "What was the name of Meta's open-source LLM family released in 2023?",
    options: ["LLaMA", "Galactica", "OPT", "BlenderBot"],
    correct: 0,
    points: 1
  },
  {
    question: "What AI image generator went viral in mid-2022?",
    options: ["DALL-E 2", "GPT-4", "AlphaFold", "Copilot"],
    correct: 0,
    points: 1
  },
  {
    question: "What term describes AI systems that can match human-level performance across tasks?",
    options: ["AGI (Artificial General Intelligence)", "ASI (Artificial Super Intelligence)", "ANI (Artificial Narrow Intelligence)", "ACI (Artificial Cognitive Intelligence)"],
    correct: 0,
    points: 1
  },
  {
    question: "What Microsoft product integrated GPT-4 as 'Copilot' across Office apps?",
    options: ["Microsoft 365", "Azure", "Windows 11", "Teams"],
    correct: 0,
    points: 1
  },
  {
    question: "What 2024 EU regulation governs AI risk categories?",
    options: ["EU AI Act", "GDPR Amendment", "Digital Services Act", "AI Safety Framework"],
    correct: 0,
    points: 1
  },
  {
    question: "What open-source AI lab from France released the Mixtral models?",
    options: ["Mistral AI", "Hugging Face", "Aleph Alpha", "LightOn"],
    correct: 0,
    points: 1
  },
  {
    question: "What reasoning technique asks a model to 'think step by step'?",
    options: ["Chain-of-thought prompting", "Few-shot learning", "Constitutional AI", "Beam search"],
    correct: 0,
    points: 1
  },
  {
    question: "What company acquired Twitter in 2022 and rebranded it to X?",
    options: ["xAI / Elon Musk", "Meta", "Microsoft", "Alphabet"],
    correct: 0,
    points: 1
  },
  {
    question: "What benchmark measures LLM performance across reasoning tasks?",
    options: ["MMLU", "ImageNet", "GLUE", "SQuAD"],
    correct: 0,
    points: 1
  },
  {
    question: "What does 'MoE' stand for in model architecture (e.g., Mixtral)?",
    options: ["Mixture of Experts", "Model of Everything", "Multi-objective Evaluation", "Maximum Output Efficiency"],
    correct: 0,
    points: 1
  },
  {
    question: "What AI coding assistant was launched by GitHub in 2021?",
    options: ["GitHub Copilot", "CodeWhisperer", "Tabnine", "Replit Ghost"],
    correct: 0,
    points: 1
  },
  {
    question: "What DeepMind system predicted 3D protein structures for nearly all known proteins?",
    options: ["AlphaFold 2", "AlphaGo", "Gato", "Gemini"],
    correct: 0,
    points: 1
  },
  {
    question: "What Sam Altman quote became a meme after his brief firing from OpenAI in November 2023?",
    options: ["\"I loved my time at OpenAI\"", "\"AGI is near\"", "\"We should slow down\"", "\"AI will save us all\""],
    correct: 0,
    points: 1
  }
]

// Trash Trivia - absurd, obscure, and delightfully useless facts
export const trashTriviaQuestions: Question[] = [
  {
    question: "What is the official state snack of Utah?",
    options: ["Jell-O", "Beef jerky", "Trail mix", "Cheese curds"],
    correct: 0,
    points: 1
  },
  {
    question: "How many times does the average person fart per day?",
    options: ["14", "3", "25", "40"],
    correct: 0,
    points: 1
  },
  {
    question: "What animal's poop is cube-shaped?",
    options: ["Wombat", "Koala", "Platypus", "Quokka"],
    correct: 0,
    points: 1
  },
  {
    question: "What was the original name of the search engine Google?",
    options: ["BackRub", "SearchBuddy", "WebCrawler", "NetSeek"],
    correct: 0,
    points: 1
  },
  {
    question: "What colour is a hippopotamus's sweat?",
    options: ["Red", "Clear", "Yellow", "Blue"],
    correct: 0,
    points: 1
  },
  {
    question: "What fruit was originally called a 'love apple'?",
    options: ["Tomato", "Strawberry", "Pomegranate", "Peach"],
    correct: 0,
    points: 1
  },
  {
    question: "What is the fear of long words called?",
    options: ["Hippopotomonstrosesquippedaliophobia", "Sesquipedalophobia", "Verbophobia", "Logophobia"],
    correct: 0,
    points: 1
  },
  {
    question: "How many years did the Hundred Years' War actually last?",
    options: ["116", "100", "99", "105"],
    correct: 0,
    points: 1
  },
  {
    question: "What country has the most vending machines per capita?",
    options: ["Japan", "United States", "South Korea", "Germany"],
    correct: 0,
    points: 1
  },
  {
    question: "What popular snack was originally invented as a wallpaper cleaner?",
    options: ["Play-Doh", "Pringles", "Cotton candy", "Bubble gum"],
    correct: 0,
    points: 1
  },
  {
    question: "What is a group of flamingos called?",
    options: ["A flamboyance", "A flock", "A flutter", "A blush"],
    correct: 0,
    points: 1
  },
  {
    question: "What was Buzz Aldrin's mother's maiden name?",
    options: ["Moon", "Star", "Armstrong", "Shepard"],
    correct: 0,
    points: 1
  },
  {
    question: "How long is a jiffy (in physics)?",
    options: ["1/100th of a second", "1 millisecond", "1 nanosecond", "1 microsecond"],
    correct: 0,
    points: 1
  },
  {
    question: "What creature has three hearts?",
    options: ["Octopus", "Starfish", "Earthworm", "Jellyfish"],
    correct: 0,
    points: 1
  },
  {
    question: "What is illegal to do in Singapore that most people do daily?",
    options: ["Chew gum", "Jaywalk", "Whistle at night", "Eat on the train"],
    correct: 0,
    points: 1
  },
  {
    question: "What company originally sold only books?",
    options: ["Amazon", "Apple", "eBay", "Walmart"],
    correct: 0,
    points: 1
  },
  {
    question: "What sport has been played on the Moon?",
    options: ["Golf", "Tennis", "Cricket", "Frisbee"],
    correct: 0,
    points: 1
  },
  {
    question: "What body part continues to grow your entire life?",
    options: ["Nose and ears", "Fingers", "Feet", "Teeth"],
    correct: 0,
    points: 1
  },
  {
    question: "What percentage of the Earth's water is fresh water?",
    options: ["About 3%", "About 10%", "About 25%", "About 50%"],
    correct: 0,
    points: 1
  },
  {
    question: "What fast food chain once had a mascot with a giant head called 'The King'?",
    options: ["Burger King", "McDonald's", "Wendy's", "KFC"],
    correct: 0,
    points: 1
  }
]

// Legacy export for backward compatibility
export const defaultQuestions = generalQuestions

// All question sets with metadata
export const questionSets: QuestionSet[] = [
  {
    id: 'general',
    name: 'General Knowledge',
    emoji: '🎯',
    description: 'Mixed trivia covering tech, culture, and business',
    questions: generalQuestions
  },
  {
    id: 'expert',
    name: 'Expert Trivia',
    emoji: '🧠',
    description: 'Super challenging questions for trivia masters',
    questions: expertQuestions
  },
  {
    id: 'startup',
    name: 'Startup Founders',
    emoji: '🚀',
    description: 'VC, business, and tech state of the art',
    questions: startupQuestions
  },
  {
    id: 'wines-australia',
    name: 'Wines of Australia',
    emoji: '🍷',
    description: 'Grape varieties, regions, and cellar door knowledge',
    questions: winesOfAustraliaQuestions
  },
  {
    id: 'ai-tech',
    name: 'AI Tech & Business',
    emoji: '🤖',
    description: 'Artificial intelligence and tech headlines post-2020',
    questions: aiTechQuestions
  },
  {
    id: 'trash-trivia',
    name: 'Trash Trivia',
    emoji: '🗑️',
    description: 'Absurd, obscure, and delightfully useless facts',
    questions: trashTriviaQuestions
  }
]

// Shuffle and randomize answer order for each question
function shuffleQuestions(questions: Question[], count?: number): Question[] {
  // Deep clone and shuffle answer options for each question
  const shuffled = questions.map(q => {
    const options = [...q.options]
    const correctAnswer = options[q.correct]
    
    // Fisher-Yates shuffle for options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    
    // Find new correct index
    const newCorrectIndex = options.indexOf(correctAnswer)
    
    return {
      ...q,
      options,
      correct: newCorrectIndex
    }
  })
  
  // Shuffle question order
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  // Return requested count or all
  return count ? shuffled.slice(0, count) : shuffled
}

// Get shuffled questions from a specific set
export function getShuffledQuestionsFromSet(setId: QuestionSetId, count?: number): Question[] {
  const set = questionSets.find(s => s.id === setId)
  if (!set) return shuffleQuestions(generalQuestions, count)
  return shuffleQuestions(set.questions, count)
}

// Legacy function for backward compatibility
export function getShuffledQuestions(count?: number): Question[] {
  return shuffleQuestions(generalQuestions, count)
}
