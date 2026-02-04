import { Question } from '../types'

// Question Set Type
export type QuestionSetId = 'general' | 'expert' | 'startup'

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
