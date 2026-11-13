/**
 * Hand a generated file to the user. On touch devices this opens the system
 * share sheet (Save to Files / iCloud Drive). Elsewhere it downloads directly.
 * The file is built in memory and never uploaded.
 */
export async function saveFile(name: string, mime: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: mime });
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (touch && typeof navigator.canShare === 'function') {
    try {
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
