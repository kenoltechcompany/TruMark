import { unlinkSync, existsSync } from 'fs';
import { Logger } from '@nestjs/common';

const logger = new Logger('FileCleanupUtil');

/**
 * Safely removes a list of file paths from local disk.
 * Catches and logs errors without breaking ongoing transactions.
 */
export function deleteLocalFiles(filePaths: string[] | null | undefined): void {
  if (!filePaths || !Array.isArray(filePaths)) return;

  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logger.debug(`Deleted file from disk: ${filePath}`);
      }
    } catch (err: any) {
      logger.warn(`Could not delete file ${filePath}: ${err.message}`);
    }
  }
}
