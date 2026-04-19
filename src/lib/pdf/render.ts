import { createElement, type ReactElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { Certificate, type CertificateProps } from "./certificate";

// Thin wrapper around @react-pdf/renderer's renderToBuffer so server
// actions don't take a direct dep on the renderer — and so future swaps
// to renderToStream (for larger docs) land in one place.
//
// The renderToBuffer type signature only accepts a direct <Document>
// element, but Certificate renders <Document> at its root. Cast is
// narrow and intentional; runtime is correct.
export async function renderCertificatePdf(
  props: CertificateProps,
): Promise<Buffer> {
  const element = createElement(Certificate, props) as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
