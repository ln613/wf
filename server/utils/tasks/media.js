import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

/**
 * Cut a media file using ffmpeg
 * @param {Object} params - Input parameters
 * @param {string} params.fileName - The input file path (required)
 * @param {number} params.duration - Duration in seconds (optional if end is provided)
 * @param {number} params.start - Start time in seconds (default: 0)
 * @param {number} params.end - End time in seconds (default: duration)
 * @param {boolean} params.isCopy - Whether to use stream copy mode (default: false)
 * @returns {Promise<Object>} Result object with success/error info
 */
export const ffmpegCut = async ({ fileName, duration, start = 0, end, isCopy = false }) => {
  validateFfmpegCutInput(fileName, duration, end)

  const endTime = end ?? (start + duration)
  const outputFileName = buildOutputFileName(fileName)
  const command = buildFfmpegCommand(fileName, start, endTime, isCopy, outputFileName)

  return executeCommand(command, outputFileName)
}

const validateFfmpegCutInput = (fileName, duration, end) => {
  if (!fileName) {
    throw new Error('File name is required')
  }
  if (end === undefined && duration === undefined) {
    throw new Error('Either duration or end time must be provided')
  }
}

const buildOutputFileName = (fileName) => {
  const ext = path.extname(fileName)
  const baseName = path.basename(fileName, ext)
  const dirName = path.dirname(fileName)
  return path.join(dirName, `${baseName}_edit${ext}`)
}

const buildFfmpegCommand = (inputFile, start, end, isCopy, outputFile) => {
  const copyFlag = isCopy ? '-c copy' : ''
  return `ffmpeg -ss ${start} -to ${end} -i "${inputFile}" ${copyFlag} "${outputFile}" -y`
}

const executeCommand = async (command, outputFileName) => {
  try {
    const { stdout, stderr } = await execAsync(command)
    return {
      success: true,
      message: `File successfully cut and saved to: ${outputFileName}`,
      outputPath: outputFileName,
      stdout,
      stderr,
    }
  } catch (error) {
    throw new Error(`FFmpeg command failed: ${error.message}`)
  }
}
