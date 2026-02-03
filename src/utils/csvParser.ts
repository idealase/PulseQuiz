import { Question } from '../types'

interface ParseResult {
  questions: Question[]
  errors: string[]
}

export function parseCSV(content: string): ParseResult {
  const errors: string[] = []
  const questions: Question[] = []

  // Split into lines, handling both \r\n and \n
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length < 2) {
    return { questions: [], errors: ['CSV must have a header row and at least one question'] }
  }

  // Parse header (case-insensitive)
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim())
  
  // Map column indices
  const colMap: Record<string, number> = {}
  const requiredCols = ['question', 'correct']
  const optionCols = ['option_a', 'option_b', 'option_c', 'option_d']
  
  headers.forEach((h, i) => {
    colMap[h] = i
  })

  // Check required columns
  for (const col of requiredCols) {
    if (colMap[col] === undefined) {
      errors.push(`Missing required column: ${col}`)
    }
  }

  // Check we have at least 2 options
  const availableOptions = optionCols.filter(o => colMap[o] !== undefined)
  if (availableOptions.length < 2) {
    errors.push('CSV must have at least option_a and option_b columns')
  }

  if (errors.length > 0) {
    return { questions: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const rowNum = i + 1
    
    try {
      const values = parseCSVLine(line)
      
      const questionText = values[colMap['question']]?.trim()
      if (!questionText) {
        errors.push(`Row ${rowNum}: Missing question text`)
        continue
      }

      // Gather options
      const options: string[] = []
      for (const optCol of optionCols) {
        if (colMap[optCol] !== undefined) {
          const optVal = values[colMap[optCol]]?.trim()
          if (optVal) {
            options.push(optVal)
          }
        }
      }

      if (options.length < 2) {
        errors.push(`Row ${rowNum}: Need at least 2 options`)
        continue
      }

      // Parse correct answer
      const correctRaw = values[colMap['correct']]?.trim().toUpperCase()
      let correctIndex: number = -1

      if (['A', 'B', 'C', 'D'].includes(correctRaw)) {
        correctIndex = correctRaw.charCodeAt(0) - 65 // A=0, B=1, etc.
      } else {
        // Try to match by text
        correctIndex = options.findIndex(
          o => o.toLowerCase() === values[colMap['correct']]?.trim().toLowerCase()
        )
      }

      if (correctIndex < 0 || correctIndex >= options.length) {
        errors.push(`Row ${rowNum}: Invalid correct answer "${correctRaw}"`)
        continue
      }

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
        options,
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

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line: string): string[] {
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
      } else if (char === ',') {
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
