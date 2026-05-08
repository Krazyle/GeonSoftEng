interface FileWithHandleAndPath extends File {
  handle?: FileSystemFileHandle;
  path: string;
}

const ignoreList = [
  "^npm-debug\\.log$",
  "^\\..*\\.swp$",

  "^\\.DS_Store$",
  "^\\.AppleDouble$",
  "^\\.LSOverride$",
  "^Icon\\r$",
  "^\\._.*",
  "^\\.Spotlight-V100(?:$|\\/)",
  "\\.Trashes",
  "^__MACOSX$",

  "~$",

  "^Thumbs\\.db$",
  "^ehthumbs\\.db$",
  "^Desktop\\.ini$",
  "@eaDir$",
];

const junkRegex = new RegExp(ignoreList.join("|"));

function isFile(input: FileSystemEntry): input is FileSystemFileEntry {
  return input.isFile;
}

function isDirectory(
  input: FileSystemEntry,
): input is FileSystemDirectoryEntry {
  return input.isDirectory;
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function getReadEntries(
  dirReader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });
}

function getHandle(
  item: DataTransferItem | undefined,
): Promise<FileSystemFileHandle | null> {
  if (!item || !(item as any).getAsFileSystemHandle) {
    return Promise.resolve(null);
  }
  return (item as any).getAsFileSystemHandle().catch((e: Error) => {
    console.error(e);
    return null;
  }) as Promise<FileSystemFileHandle | null>;
}

function readFile(
  entry: FileSystemFileEntry,
  item: DataTransferItem | undefined,
  path: string,
): Promise<FileWithHandleAndPath> {
  return Promise.all([getFile(entry), getHandle(item)]).then(
    ([file, handle]) => {
      if (handle) {
        (file as any).handle = handle;
      }

      (file as any).path = path + file.name;

      return file as FileWithHandleAndPath;
    },
  );
}

async function dirReadEntries(
  dirReader: FileSystemDirectoryReader,
  path: string,
): Promise<FileWithHandleAndPath[]> {
  return getReadEntries(dirReader).then((entries) => {
    const getFilesPromises = entries.map((entry) =>
      getFilesFromEntry(entry, undefined, path),
    );

    return Promise.all(getFilesPromises).then((nested) => nested.flat());
  });
}

async function readDir(
  entry: FileSystemDirectoryEntry,
  path: string,
): Promise<FileWithHandleAndPath[]> {
  const dirReader = entry.createReader();
  const newPath = `${path + entry.name}/`;
  let files: FileWithHandleAndPath[] = [];
  let newFiles: FileWithHandleAndPath[];
  do {
    newFiles = await dirReadEntries(dirReader, newPath);
    files = files.concat(newFiles);
  } while (newFiles.length > 0);
  return files;
}

function getFilesFromEntry(
  entry: FileSystemEntry,
  item: DataTransferItem | undefined,
  path = "",
): Promise<FileWithHandleAndPath[]> {
  if (isFile(entry)) {
    return readFile(entry, item, path).then((file) => [file]);
  }
  if (isDirectory(entry)) {
    return readDir(entry, path);
  }
  return Promise.resolve([]);
}

export function getFilesFromDataTransferItems(
  dataTransferItems: DataTransferItemList,
): Promise<FileWithHandleAndPath[]> {
  const inputs: [FileSystemEntry, DataTransferItem][] = [];

  for (const item of dataTransferItems) {
    const entry = item.webkitGetAsEntry();
    if (entry) inputs.push([entry, item]);
  }

  return Promise.all(
    inputs.map(([entry, item]) => getFilesFromEntry(entry, item)),
  ).then((nested) => {
    return nested.flat().filter((file) => !junkRegex.test(file.name));
  });
}
