export interface OutputOptions {
  json?: boolean;
}

export function outputResult<T>(
  data: T,
  options: OutputOptions,
  renderHuman: () => void
): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    renderHuman();
  }
}

export function outputError(
  error: string,
  code: string,
  options: OutputOptions,
  statusCode = 1
): never {
  if (options.json) {
    console.error(
      JSON.stringify(
        {
          error,
          code,
        },
        null,
        2
      )
    );
  } else {
    console.error(`✖ Error [${code}]: ${error}`);
  }
  process.exit(statusCode);
}
