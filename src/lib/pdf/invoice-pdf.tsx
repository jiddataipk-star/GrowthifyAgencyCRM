import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
let fontsReady = false;

function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: path.join(FONT_DIR, "montserrat-latin-500-normal.woff"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "montserrat-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "montserrat-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "montserrat-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const C = {
  ink: "#07150F",
  band: "#06140E",
  lime: "#C8FF40",
  green: "#0F2B20",
  text2: "#4F6258",
  muted: "#7A8D83",
  line: "#E3ECE7",
  soft: "#F4F7F5",
  danger: "#C9401F",
  success: "#087A54",
};

const s = StyleSheet.create({
  page: { fontFamily: "Montserrat", fontSize: 9.5, color: C.ink, paddingBottom: 70 },
  band: { backgroundColor: C.band, paddingHorizontal: 40, paddingTop: 30, paddingBottom: 26, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 170, height: 59.5, marginLeft: -18, marginTop: -8 },
  titleBlock: { alignItems: "flex-end" },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: 800, letterSpacing: 1 },
  number: { color: C.lime, fontSize: 11, fontWeight: 700, marginTop: 4 },
  statusPill: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, fontSize: 8, fontWeight: 700 },
  body: { paddingHorizontal: 40, paddingTop: 26 },
  row: { flexDirection: "row" },
  col: { flex: 1 },
  label: { fontSize: 7.5, fontWeight: 700, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 },
  strong: { fontWeight: 700, fontSize: 11 },
  textLine: { color: C.text2, marginTop: 2 },
  metaBox: { backgroundColor: C.soft, borderRadius: 10, padding: 12, flexDirection: "row", marginTop: 22 },
  metaItem: { flex: 1 },
  metaValue: { fontWeight: 700, fontSize: 10 },
  table: { marginTop: 22 },
  th: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 6 },
  thText: { fontSize: 7.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 9 },
  cDesc: { flex: 1, paddingRight: 10 },
  cQty: { width: 50, textAlign: "right" },
  cPrice: { width: 95, textAlign: "right" },
  cAmount: { width: 100, textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: 250 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  grand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.green, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6 },
  grandText: { color: "#FFFFFF", fontWeight: 800, fontSize: 12 },
  grandAmount: { color: C.lime, fontWeight: 800, fontSize: 12 },
  payBox: { marginTop: 26, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14 },
  notes: { marginTop: 16, color: C.text2, lineHeight: 1.5 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 26, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 7.5 },
  accentBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: C.lime },
});

export type InvoicePdfData = {
  number: string;
  status: string;
  displayStatus: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  items: { description: string; qty: number; unit_price: number; amount: number }[];
  client: { business_name: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; country: string | null; ntn: string | null };
  project: { title: string } | null;
  company: {
    company_name: string;
    tagline: string | null;
    email: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    show_whatsapp_on_invoice: boolean;
    website: string | null;
    address: string | null;
    city: string | null;
    country: string;
    ntn: string | null;
    strn: string | null;
    bank_name: string | null;
    account_title: string | null;
    account_number: string | null;
    iban: string | null;
    wallet_details: string | null;
    payment_notes: string | null;
    invoice_footer: string | null;
  };
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  paid: { bg: C.lime, fg: C.ink, label: "PAID" },
  partial: { bg: "#F5B841", fg: C.ink, label: "PARTLY PAID" },
  overdue: { bg: C.danger, fg: "#FFFFFF", label: "OVERDUE" },
  void: { bg: "#6E8A7C", fg: "#FFFFFF", label: "VOID" },
  draft: { bg: "#6E8A7C", fg: "#FFFFFF", label: "DRAFT" },
};

function InvoiceDocument({ data, logo }: { data: InvoicePdfData; logo: Buffer }) {
  const money = (minor: number) => formatMoney(minor, data.currency);
  const company = data.company;
  const status = STATUS_STYLE[data.displayStatus];
  const balance = Math.max(data.total - data.amount_paid, 0);
  const hasBank = company.bank_name || company.account_number || company.iban || company.wallet_details || company.payment_notes;
  const companyContact = [company.email, company.show_whatsapp_on_invoice && company.whatsapp_number ? formatPhone(company.whatsapp_number) : company.phone ? formatPhone(company.phone) : null, company.website]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={`Invoice ${data.number}`} author={company.company_name} creator="Growthify OS" producer="Growthify OS">
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={{ data: logo, format: "png" }} style={s.logo} />
          <View style={s.titleBlock}>
            <Text style={s.title}>INVOICE</Text>
            <Text style={s.number}>{data.number}</Text>
            {status ? <Text style={[s.statusPill, { backgroundColor: status.bg, color: status.fg }]}>{status.label}</Text> : null}
          </View>
        </View>

        <View style={s.body}>
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>From</Text>
              <Text style={s.strong}>{company.company_name}</Text>
              {company.address ? <Text style={s.textLine}>{company.address}</Text> : null}
              <Text style={s.textLine}>{[company.city, company.country].filter(Boolean).join(", ")}</Text>
              {companyContact ? <Text style={s.textLine}>{companyContact}</Text> : null}
              {company.ntn ? <Text style={s.textLine}>NTN: {company.ntn}{company.strn ? `  ·  STRN: ${company.strn}` : ""}</Text> : null}
            </View>
            <View style={s.col}>
              <Text style={s.label}>Bill to</Text>
              <Text style={s.strong}>{data.client.business_name}</Text>
              {data.client.contact_name ? <Text style={s.textLine}>Attn: {data.client.contact_name}</Text> : null}
              {data.client.address ? <Text style={s.textLine}>{data.client.address}</Text> : null}
              {data.client.city ? <Text style={s.textLine}>{[data.client.city, data.client.country].filter(Boolean).join(", ")}</Text> : null}
              {data.client.email ? <Text style={s.textLine}>{data.client.email}</Text> : null}
              {data.client.ntn ? <Text style={s.textLine}>NTN: {data.client.ntn}</Text> : null}
            </View>
          </View>

          <View style={s.metaBox}>
            <View style={s.metaItem}>
              <Text style={s.label}>Issue date</Text>
              <Text style={s.metaValue}>{formatDate(data.issue_date)}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.label}>Due date</Text>
              <Text style={s.metaValue}>{formatDate(data.due_date)}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.label}>Project</Text>
              <Text style={s.metaValue}>{data.project?.title ?? "—"}</Text>
            </View>
            <View style={[s.metaItem, { alignItems: "flex-end" }]}>
              <Text style={s.label}>Balance due</Text>
              <Text style={[s.metaValue, { color: balance ? C.ink : C.success }]}>{money(balance)}</Text>
            </View>
          </View>

          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thText, s.cDesc]}>Description</Text>
              <Text style={[s.thText, s.cQty]}>Qty</Text>
              <Text style={[s.thText, s.cPrice]}>Unit price</Text>
              <Text style={[s.thText, s.cAmount]}>Amount</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <Text style={s.cDesc}>{item.description}</Text>
                <Text style={s.cQty}>{Number(item.qty).toLocaleString("en-US", { maximumFractionDigits: 2 })}</Text>
                <Text style={s.cPrice}>{money(item.unit_price)}</Text>
                <Text style={[s.cAmount, { fontWeight: 700 }]}>{money(item.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={s.totals} wrap={false}>
            <View style={s.totalRow}>
              <Text style={{ color: C.text2 }}>Subtotal</Text>
              <Text>{money(data.subtotal)}</Text>
            </View>
            {data.discount ? (
              <View style={s.totalRow}>
                <Text style={{ color: C.text2 }}>Discount</Text>
                <Text>−{money(data.discount)}</Text>
              </View>
            ) : null}
            {data.tax ? (
              <View style={s.totalRow}>
                <Text style={{ color: C.text2 }}>Sales tax ({Number(data.tax_rate)}%)</Text>
                <Text>{money(data.tax)}</Text>
              </View>
            ) : null}
            <View style={s.grand}>
              <Text style={s.grandText}>Total</Text>
              <Text style={s.grandAmount}>{money(data.total)}</Text>
            </View>
            {data.amount_paid ? (
              <>
                <View style={[s.totalRow, { marginTop: 6 }]}>
                  <Text style={{ color: C.text2 }}>Paid (incl. tax withheld)</Text>
                  <Text style={{ color: C.success }}>−{money(data.amount_paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={{ fontWeight: 700 }}>Balance due</Text>
                  <Text style={{ fontWeight: 700 }}>{money(balance)}</Text>
                </View>
              </>
            ) : null}
          </View>

          {hasBank ? (
            <View style={s.payBox} wrap={false}>
              <Text style={s.label}>Payment details</Text>
              <View style={s.row}>
                <View style={s.col}>
                  {company.bank_name ? <Text style={s.textLine}>Bank: <Text style={{ fontWeight: 700, color: C.ink }}>{company.bank_name}</Text></Text> : null}
                  {company.account_title ? <Text style={s.textLine}>Account title: <Text style={{ fontWeight: 700, color: C.ink }}>{company.account_title}</Text></Text> : null}
                  {company.account_number ? <Text style={s.textLine}>Account no: <Text style={{ fontWeight: 700, color: C.ink }}>{company.account_number}</Text></Text> : null}
                  {company.iban ? <Text style={s.textLine}>IBAN: <Text style={{ fontWeight: 700, color: C.ink }}>{company.iban}</Text></Text> : null}
                </View>
                <View style={s.col}>
                  {company.wallet_details ? <Text style={s.textLine}>{company.wallet_details}</Text> : null}
                  {company.payment_notes ? <Text style={[s.textLine, { marginTop: 4 }]}>{company.payment_notes}</Text> : null}
                </View>
              </View>
              <Text style={[s.textLine, { marginTop: 6, fontSize: 8 }]}>Please share the transaction ID / receipt after payment and mention {data.number}.</Text>
            </View>
          ) : null}

          {data.notes ? (
            <View style={{ marginTop: 18 }} wrap={false}>
              <Text style={s.label}>Notes</Text>
              <Text style={s.notes}>{data.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>{company.invoice_footer || company.tagline || "We build the systems your business runs on."}</Text>
          <Text render={({ pageNumber, totalPages }) => `${data.number} · ${pageNumber}/${totalPages}`} />
        </View>
        <View style={s.accentBar} fixed />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  registerFonts();
  const logo = await readFile(path.join(process.cwd(), "public/brand/growthify-logo-on-dark.png"));
  return renderToBuffer(<InvoiceDocument data={data} logo={logo} />);
}
