import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { browser } from "$app/environment";
import PandocWorker from "$lib/workers/pandoc?worker&url";

// PDF conversion uses jsPDF and html2canvas (dynamically imported below)

export class PandocConverter extends Converter {
	public name = "pandoc";
	public ready = $state(false);
	public wasm: ArrayBuffer = null!;

	constructor() {
		super();
		if (!browser) return;
		(async () => {
			this.wasm = await fetch("/pandoc.wasm").then((r) =>
				r.arrayBuffer(),
			);
			this.ready = true;
		})();
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		if (to === ".pdf") {
			// Only allow .md or .html as input for PDF
			if (!(input.from === ".md" || input.from === ".markdown" || input.from === ".html")) {
				throw new Error("PDF export is only supported from Markdown or HTML input.");
			}

			// Step 1: Convert to HTML if needed
			let htmlContent: string;
			if (input.from === ".html") {
				// Read HTML file as text
				htmlContent = await input.file.text();
			} else {
				// Use the worker to convert to HTML
				const worker = new Worker(PandocWorker, { type: "module" });
				worker.postMessage({ type: "load", wasm: this.wasm });
				await waitForMessage(worker, "loaded");
				worker.postMessage({ type: "convert", to: ".html", file: input.file });
				const result = await waitForMessage(worker);
				worker.terminate();
				if (result.type === "error") {
					throw new Error(result.error);
				}
				// Convert Uint8Array to string
				htmlContent = new TextDecoder().decode(result.output);
			}

			// Step 2: Convert HTML to PDF using jsPDF + html2canvas
			const { jsPDF } = await import("jspdf");
			const html2canvas = (await import("html2canvas")).default;

			// Create a hidden iframe to render the HTML
			const iframe = document.createElement("iframe");
			iframe.style.position = "fixed";
			iframe.style.left = "-9999px";
			// Use A4 dimensions (595 x 842 in points at 72dpi)
			// Using width slightly less than A4 to avoid overflow
			iframe.style.width = "520px";
			iframe.style.height = "800px";
			iframe.style.visibility = "hidden";
			document.body.appendChild(iframe);

			// Add necessary styles for PDF output
			const styledHtml = `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						body {
							font-family: Arial, sans-serif;
							margin: 0;
							padding: 0;
							font-size: 12px;
							line-height: 1.5;
							width: 100%;
							box-sizing: border-box;
							word-wrap: break-word;
							overflow-wrap: break-word;
						}
						img {
							max-width: 100%;
							height: auto;
						}
						pre, code {
							white-space: pre-wrap;
							overflow-wrap: break-word;
							word-wrap: break-word;
						}
						table {
							width: 100%;
							border-collapse: collapse;
							table-layout: fixed;
						}
						td, th {
							word-break: break-word;
						}
					</style>
				</head>
				<body>
					${htmlContent}
				</body>
				</html>
			`;
			
			iframe.srcdoc = styledHtml;

			await new Promise((resolve) => {
				iframe.onload = () => resolve(null);
			});

			const doc = iframe.contentDocument || iframe.contentWindow?.document;
			if (!doc) {
				iframe.remove();
				throw new Error("Failed to render HTML for PDF export.");
			}
			const body = doc.body;

			// Use html2canvas to render the body with higher quality
			const canvas = await html2canvas(body, {
				scale: 2, // Higher scale for better quality
				logging: false,
				useCORS: true,
				allowTaint: true
			});

			// Use standard A4 format with proper margins
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "pt",
				format: "a4"
			});

			// PDF dimensions
			const pdfWidth = pdf.internal.pageSize.getWidth();
			const pdfHeight = pdf.internal.pageSize.getHeight();
			
			// Calculate scaling to fit content while maintaining aspect ratio
			const canvasAspectRatio = canvas.width / canvas.height;
			const pageAspectRatio = pdfWidth / pdfHeight;
			
			let renderWidth, renderHeight;
			
			if (canvasAspectRatio > pageAspectRatio) {
				// Canvas is wider than page (relative to height)
				renderWidth = pdfWidth;
				renderHeight = renderWidth / canvasAspectRatio;
			} else {
				// Canvas is taller than page (relative to width)
				renderHeight = pdfHeight;
				renderWidth = renderHeight * canvasAspectRatio;
			}
			
			// Add margins
			const margin = 40; // 40pt margin
			renderWidth -= margin * 2;
			renderHeight = (renderWidth / canvas.width) * canvas.height;
			
			const imgData = canvas.toDataURL("image/jpeg", 1.0);
			pdf.addImage(imgData, "JPEG", margin, margin, renderWidth, renderHeight);
			
			const pdfBlob = pdf.output("blob");
			iframe.remove();

			return new VertFile(
				new File([pdfBlob], input.name.replace(/\.[^.]+$/, ".pdf"), { type: "application/pdf" }),
				".pdf"
			);
		}

		// Default: use the worker for other formats
		const worker = new Worker(PandocWorker, {
			type: "module",
		});
		worker.postMessage({ type: "load", wasm: this.wasm });
		await waitForMessage(worker, "loaded");
		worker.postMessage({
			type: "convert",
			to,
			file: input.file,
		});
		const result = await waitForMessage(worker);
		if (result.type === "error") {
			worker.terminate();
			// throw new Error(result.error);
			switch (result.errorKind) {
				case "PandocUnknownReaderError": {
					throw new Error(
						`${input.from} is not a supported input format for documents.`,
					);
				}

				case "PandocUnknownWriterError": {
					throw new Error(
						`${to} is not a supported output format for documents.`,
					);
				}

				default:
					if (result.errorKind)
						throw new Error(
							`[${result.errorKind}] ${result.error}`,
						);
					else throw new Error(result.error);
			}
		}
		worker.terminate();
		if (!to.startsWith(".")) to = `.${to}`;
		return new VertFile(
			new File([result.output], input.name),
			result.isZip ? ".zip" : to,
		);
	}

	public supportedFormats = [
		new FormatInfo("docx", true, true),
		new FormatInfo("xml", true, true),
		new FormatInfo("doc", true, true),
		new FormatInfo("md", true, true),
		new FormatInfo("html", true, true),
		new FormatInfo("rtf", true, true),
		new FormatInfo("csv", true, true),
		new FormatInfo("tsv", true, true),
		new FormatInfo("json", true, true),
		new FormatInfo("rst", true, true),
		new FormatInfo("epub", true, true),
		new FormatInfo("odt", true, true),
		new FormatInfo("docbook", true, true),
		// PDF: only allow as output, not input
		new FormatInfo("pdf", false, true),
	];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitForMessage(worker: Worker, type?: string): Promise<any> {
	return new Promise((resolve) => {
		const onMessage = (e: MessageEvent) => {
			if (type && e.data.type === type) {
				worker.removeEventListener("message", onMessage);
				resolve(e.data);
			} else {
				worker.removeEventListener("message", onMessage);
				resolve(e.data);
			}
		};
		worker.addEventListener("message", onMessage);
	});
}
