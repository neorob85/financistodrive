import unzipper from 'unzipper'
import { mkdir, writeFile } from 'fs/promises'
import { resolve, dirname, sep } from 'path'

/**
 * Extracts a ZIP buffer to targetDir, rejecting any entry whose resolved
 * path would escape the target directory (Zip Slip prevention).
 */
export async function extractZipSafe(data: Buffer, targetDir: string): Promise<void> {
    const resolvedRoot = resolve(targetDir)
    await mkdir(resolvedRoot, { recursive: true })

    const directory = await unzipper.Open.buffer(data)

    for (const entry of directory.files) {
        const resolvedEntry = resolve(resolvedRoot, entry.path)

        // Reject paths that escape the target directory
        if (!resolvedEntry.startsWith(resolvedRoot + sep) && resolvedEntry !== resolvedRoot) {
            throw createError({ statusCode: 400, message: `Percorso non valido nel file ZIP: ${entry.path}` })
        }

        if (entry.type === 'Directory') {
            await mkdir(resolvedEntry, { recursive: true })
        } else {
            await mkdir(dirname(resolvedEntry), { recursive: true })
            const content = await entry.buffer()
            await writeFile(resolvedEntry, content)
        }
    }
}
