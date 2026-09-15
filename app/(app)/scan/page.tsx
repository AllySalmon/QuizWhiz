import { ScanUploadForm } from "./ScanUploadForm";

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scan &amp; Upload</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each submission becomes one batch. Upload photos, scanned images, or a multi-page PDF —
        each page becomes its own test.
      </p>

      <div className="mt-6">
        <ScanUploadForm />
      </div>
    </div>
  );
}
