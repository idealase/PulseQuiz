import { Question } from '../types'

interface ParseResult {
  questions: Question[]
  errors: string[]
}

// Column name aliases for flexible CSV support
const COLUMN_ALIASES: Record<string, string[]> = {
  'question': ['question', 'q', 'text'],
  'correct': ['correct', 'correct answer', 'answer', 'correct_answer'],
  'option_a': ['option_a', 'a', 'wrong answer 1', 'wrong_answer_1', 'option1'],
  'option_b': ['option_b', 'b', 'wrong answer 2', 'wrong_answer_2', 'option2'],
  'option_c': ['option_c', 'c', 'wrong answer 3', 'wrong_answer_3', 'option3'],
  'option_d': ['option_d', 'd', 'wrong answer 4', 'wrong_answer_4', 'option4'],
  'explanation': ['explanation', 'explain', 'notes'],
  'points': ['points', 'score', 'value']
}

function normalizeColumnName(header: string): string | null {
  const normalized = header.toLowerCase().trim()
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(normalized)) {
      return canonical
    }
  }
  return null
}

function detectDelimiter(line: string): string {
  // Count potential delimiters
  const commaCount = (line.match(/,/g) || []).length
  const semicolonCount = (line.match(/;/g) || []).length
  const tabCount = (line.match(/\t/g) || []).length
  
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';'
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  return ','
}

export function parseCSV(content: string): ParseResult {
  const errors: string[] = []
  const questions: Question[] = []

  // Split into lines, handling both \r\n and \n
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length < 2) {
    return { questions: [], errors: ['CSV must have a header row and at least one question'] }
  }

  // Detect delimiter from header line
  const headerLine = lines[0]
  const delimiter = detectDelimiter(headerLine)
  
  // Parse header (case-insensitive, with alias support)
  const rawHeaders = parseCSVLine(headerLine, delimiter)
  const headers = rawHeaders.map(h => normalizeColumnName(h))
  
  // Map column indices
  const colMap: Record<string, number> = {}
  
  headers.forEach((h, i) => {
    if (h) colMap[h] = i
  })

  // For Mentimeter-style CSVs where first col is question, second is correct answer,
  // and remaining are wrong answers - detect this pattern
  const isMentiStyle = colMap['question'] !== undefined && 
                       colMap['correct'] !== undefined &&
                       (colMap['option_a'] !== undefined || headers.some(h => h?.startsWith('option_')))

  // If we have question and correct but no explicit options, 
  // the wrong answer columns become our options
  const hasExplicitOptions = ['option_a', 'option_b', 'option_c', 'option_d'].some(o => colMap[o] !== undefined)
  
  if (!isMentiStyle && !hasExplicitOptions) {
    // Try fallback: assume columns are question, correct, wrong1, wrong2, wrong3...
    if (rawHeaders.length >= 3) {
      colMap['question'] = 0
      colMap['correct'] = 1
      for (let i = 2; i < rawHeaders.length && i < 6; i++) {
        colMap[`option_${String.fromCharCode(97 + i - 2)}`] = i // option_a, option_b, etc.
      }
    }
  }

  // Validate we have minimum required columns
  if (colMap['question'] === undefined) {
    errors.push('Missing required column: question')
  }
  if (colMap['correct'] === undefined) {
    errors.push('Missing required column: correct answer')
  }

  // Check we have at least 1 wrong answer option
  const optionCols = ['option_a', 'option_b', 'option_c', 'option_d'].filter(o => colMap[o] !== undefined)
  if (optionCols.length < 1) {
    errors.push('CSV must have at least one wrong answer column')
  }

  if (errors.length > 0) {
    return { questions: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const rowNum = i + 1
    
    try {
      const values = parseCSVLine(line, delimiter)
      
      const questionText = values[colMap['question']]?.trim()
      if (!questionText) {
        errors.push(`Row ${rowNum}: Missing question text`)
        continue
      }

      // Get correct answer text
      const correctAnswer = values[colMap['correct']]?.trim()
      if (!correctAnswer) {
        errors.push(`Row ${rowNum}: Missing correct answer`)
        continue
      }

      // Gather wrong answer options
      const wrongAnswers: string[] = []
      for (const optCol of optionCols) {
        const optVal = values[colMap[optCol]]?.trim()
        if (optVal) {
          wrongAnswers.push(optVal)
        }
      }

      if (wrongAnswers.length < 1) {
        errors.push(`Row ${rowNum}: Need at least 1 wrong answer`)
        continue
      }

      // Build options array with correct answer first, then shuffle
      const allOptions = [correctAnswer, ...wrongAnswers]
      
      // Shuffle options deterministically based on question text
      const shuffled = shuffleWithSeed(allOptions, hashString(questionText))
      const correctIndex = shuffled.indexOf(correctAnswer)

      // Optional fields
      const explanation = colMap['explanation'] !== undefined 
        ? values[colMap['explanation']]?.trim() 
        : undefined
      
      const pointsRaw = colMap['points'] !== undefined 
        ? values[colMap['points']]?.trim() 
        : '1'
      const points = parseInt(pointsRaw) || 1

      questions.push({
        question: questionText,
        options: shuffled,
        correct: correctIndex,
        explanation: explanation || undefined,
        points
      })
    } catch (e) {
      errors.push(`Row ${rowNum}: Parse error - ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  return { questions, errors }
}

// Simple hash function for deterministic shuffling
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Shuffle array with a seed for deterministic results
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let currentSeed = seed
  
  const random = () => {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff
    return currentSeed / 0x7fffffff
  }
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  
  return result
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  
  result.push(current)
  return result
}
