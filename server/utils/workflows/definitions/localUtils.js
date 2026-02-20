import { stat, readdir, copyFile, unlink, mkdir, access } from 'fs/promises'
import { join, basename } from 'path'
import { pinyin } from 'pinyin-pro'

// ============================================================
// KS Cut utilities
// ============================================================

/**
 * Resolve a file path to a list of .mp4 files
 * If path is a folder, returns all .mp4 files; otherwise returns the single file
 */
export const getMp4Files = async (ctx) => {
  validatePath(ctx.path)
  const s = await stat(ctx.path)
  if (s.isDirectory()) {
    const entries = await readdir(ctx.path)
    return {
      files: entries
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => join(ctx.path, f)),
    }
  }
  return { files: [ctx.path] }
}

/**
 * Compute cut start/end times from trim values and duration
 */
export const computeKsCutTimes = (ctx) => ({
  cutStart: parseFloat(ctx.trimStart) || 0,
  cutEnd: ctx.durationResult.duration - (parseFloat(ctx.trimEnd) || 0),
})

// ============================================================
// Comfy FSV utilities
// ============================================================

const COMFY_INPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\input'
const COMFY_OUTPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\output'
const OUTPUT_BASE_DIR = 'C:\\T\\fg\\v'

/**
 * Resolve scope (file or folder) to a list of files with optional folder name
 */
export const getFilesWithFolderName = async (ctx) => {
  validatePath(ctx.scope)
  const s = await stat(ctx.scope)
  if (s.isDirectory()) {
    const entries = await readdir(ctx.scope)
    return {
      files: entries.map((f) => join(ctx.scope, f)),
      folderName: basename(ctx.scope),
    }
  }
  return { files: [ctx.scope], folderName: null }
}

/**
 * Prepare comfy FSV file processing: compute target info and check if target exists
 * If target exists, sets skipped=true; otherwise copies file to comfy input
 */
export const prepareComfyFsvFile = async (ctx) => {
  const fileName = basename(ctx.file)
  const targetFileName = `${ctx.type}-${fileName}`
  const targetFolder = getOutputDestinationDir(ctx.folderName)
  const targetFilePath = join(targetFolder, targetFileName)

  if (await fileExists(targetFilePath)) {
    console.log(`Target file already exists, skipping: ${targetFilePath}`)
    return {
      shouldProcess: false,
      fileName,
      targetFileName,
      targetFolder,
      message: `Skipped ${fileName} - target already exists`,
    }
  }

  const copiedFilePath = await copyFileToComfyInput(ctx.file, fileName)
  return {
    shouldProcess: true,
    fileName,
    targetFileName,
    targetFolder,
    copiedFilePath,
  }
}

/**
 * Build comfy workflow params based on type, fileName, count, and order
 */
export const buildComfyFsvWorkflowInputs = (ctx) => {
  const faces = calculateFaces(ctx.count)
  const workflowPath = `./server/utils/comfy/${ctx.type}.json`
  const params = buildComfyFsvParams(ctx.type, ctx.prepResult.fileName, faces, ctx.order)
  return { workflowPath, params, outputKey: 'images:31' }
}

/**
 * Post-process comfy FSV result: rename, move output file, delete copied input
 */
export const postProcessComfyFsv = async (ctx) => {
  const outputFileName = ctx.comfyResult
  const { targetFileName, targetFolder, copiedFilePath } = ctx.prepResult

  const renamedFileName = await renameAndMoveGeneratedFile(
    outputFileName,
    targetFileName,
    targetFolder,
  )
  await deleteCopiedInputFile(copiedFilePath)

  return {
    success: true,
    fileName: renamedFileName || targetFileName,
    message: `Successfully processed ${ctx.prepResult.fileName}`,
  }
}

// ============================================================
// Shared helpers
// ============================================================

const validatePath = (filePath) => {
  if (!filePath) throw new Error('File path is required')
}

const fileExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const copyFileToComfyInput = async (sourcePath, fileName) => {
  const destPath = join(COMFY_INPUT_DIR, fileName)
  await copyFile(sourcePath, destPath)
  return destPath
}

const convertChineseToFolderName = (name) => {
  if (!name) return null
  const hasChinese = /[\u4e00-\u9fa5]/.test(name)
  if (!hasChinese) return name
  const pinyinResult = pinyin(name, { toneType: 'none', type: 'array' })
  return pinyinResult.join('')
}

const getOutputDestinationDir = (folderName) => {
  if (!folderName) return OUTPUT_BASE_DIR
  const convertedFolderName = convertChineseToFolderName(folderName)
  return join(OUTPUT_BASE_DIR, convertedFolderName)
}

const calculateFaces = (count) => {
  if (count === '2' || count === 2) return '0,1'
  if (count === '3' || count === 3) return '0,1,2'
  return '0'
}

const buildComfyFsvParams = (type, fileName, faces, order) => {
  if (type === 'fsvr') {
    return [{ key: '45.inputs.video', value: `ComfyUI/input/${fileName}` }]
  }
  return [
    { key: '47.inputs.video', value: fileName },
    { key: '41.inputs.input_faces_index', value: faces },
    { key: '41.inputs.input_faces_order', value: order },
  ]
}

const moveFileCrossDevice = async (sourcePath, destPath) => {
  await copyFile(sourcePath, destPath)
  await unlink(sourcePath)
}

const renameAndMoveGeneratedFile = async (outputFileName, targetFileName, targetFolder) => {
  if (!outputFileName) {
    console.log('No output file name, skipping rename and move')
    return null
  }

  const oldPath = join(COMFY_OUTPUT_DIR, outputFileName)
  await mkdir(targetFolder, { recursive: true })
  const destPath = join(targetFolder, targetFileName)

  console.log(`Moving and renaming: ${oldPath} -> ${destPath}`)
  try {
    await moveFileCrossDevice(oldPath, destPath)
    console.log('Move and rename successful')
    return targetFileName
  } catch (error) {
    console.error(`Failed to move and rename output file: ${error.message}`)
    return null
  }
}

const deleteCopiedInputFile = async (copiedFilePath) => {
  console.log(`Deleting copied file: ${copiedFilePath}`)
  try {
    await unlink(copiedFilePath)
    console.log('Delete successful')
  } catch (error) {
    console.error(`Failed to delete copied input file: ${error.message}`)
  }
}
