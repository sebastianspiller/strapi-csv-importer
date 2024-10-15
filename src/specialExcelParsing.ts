import { Transform, TransformCallback } from "stream";

/**
 * When using Excel to create CSV files, we need to modify the data before processing it.
 * For instance:
 * - Line Breaks in a cell are represented by "\n" and need to be replaced by a space
 *
 */
class SpecialExcelParsing extends Transform {
  private insideQuotes: boolean = false;
  constructor() {
    super({ objectMode: true });
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    if (process.env.SPECIAL_EXCEL_PARSING) {
      const csvRow = chunk.toString();
      let modifiedRow = "";

      for (let i = 0; i < csvRow.length; i++) {
        const char = csvRow[i];

        if (char === '"') {
          this.insideQuotes = !this.insideQuotes;
          // remove quotes
          continue;
        }

        if (this.insideQuotes && char === "\n") {
          modifiedRow += " ";
        } else {
          modifiedRow += char;
        }
      }

      chunk = Buffer.from(modifiedRow, encoding);
      this.push(chunk);
    } else {
      this.push(chunk);
    }
    callback();
  }
}

const specialExcelParsing = new SpecialExcelParsing();

export default specialExcelParsing;
