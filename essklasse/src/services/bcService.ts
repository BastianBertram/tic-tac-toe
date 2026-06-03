/**
 * Business Central OData v4 Service
 *
 * Creates a Verkaufsauftrag (Sales Order) for each Bewirtungsbeleg.
 * Adjust entity set names and field mappings to your BC customisation.
 */

import { Bewirtungsbeleg, BelegPosition } from '../types';
import { BC_CONFIG, getStoredToken } from './authService';

const BASE = BC_CONFIG.baseUrl;
const COMPANY = BC_CONFIG.companyId;

async function headers(): Promise<HeadersInit> {
  const token = await getStoredToken();
  if (!token) throw new Error('Nicht angemeldet – bitte neu einloggen.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-Version': '4.0',
  };
}

// ---------- Sales Order header ----------

interface BCSalesOrderPayload {
  customerNo: string;
  orderDate: string;
  requestedDeliveryDate: string;
  yourReference: string;
  externalDocumentNo: string;
  salespersonCode: string;
  shortcutDimension1Code: string;  // Kostenstelle
  shortcutDimension2Code: string;  // Kostenträger
  // Custom fields (via extension):
  hwkBesteller: string;
  hwkVeranstaltung: string;
  hwkOrt: string;
  hwkRaum: string;
  hwkPersonenzahl: number;
  hwkUhrzeitVon: string;
  hwkUhrzeitBis: string;
  hwkWuensche: string;
  hwkInterneNotiz: string;
}

function buildOrderPayload(beleg: Bewirtungsbeleg): BCSalesOrderPayload {
  return {
    customerNo: beleg.konto,
    orderDate: beleg.cateringDatumVon,
    requestedDeliveryDate: beleg.cateringDatumVon,
    yourReference: beleg.veranstaltung,
    externalDocumentNo: beleg.id,
    salespersonCode: '',
    shortcutDimension1Code: beleg.kostenstelle,
    shortcutDimension2Code: beleg.kostentraeger,
    hwkBesteller: beleg.besteller,
    hwkVeranstaltung: beleg.veranstaltung,
    hwkOrt: beleg.ort,
    hwkRaum: beleg.raum,
    hwkPersonenzahl: beleg.personenzahl,
    hwkUhrzeitVon: beleg.uhrzeitVon,
    hwkUhrzeitBis: beleg.uhrzeitBis,
    hwkWuensche: beleg.wuensche,
    hwkInterneNotiz: beleg.interneNotiz,
  };
}

// ---------- Sales Order line ----------

function buildLinePayload(pos: BelegPosition, documentId: string, lineNo: number) {
  return {
    documentId,
    lineNo,
    type: 'Item',
    description: `[${pos.kategorie}] ${pos.bezeichnung}`,
    unitOfMeasureCode: pos.einheit,
    unitPrice: pos.preis,
    quantity: pos.menge,
  };
}

// ---------- Public API ----------

export interface BCResult {
  auftragsnummer: string;
  documentId: string;
}

export async function createSalesOrder(beleg: Bewirtungsbeleg): Promise<BCResult> {
  const h = await headers();

  // 1. Create header
  const orderRes = await fetch(
    `${BASE}/Company('${COMPANY}')/salesOrders`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify(buildOrderPayload(beleg)),
    }
  );

  if (!orderRes.ok) {
    const err = await orderRes.text();
    throw new Error(`BC Auftrag konnte nicht angelegt werden: ${err}`);
  }

  const order = await orderRes.json();
  const documentId: string = order.id;
  const auftragsnummer: string = order.number;

  // 2. Create lines
  for (let i = 0; i < beleg.positionen.length; i++) {
    const pos = beleg.positionen[i];
    const lineRes = await fetch(
      `${BASE}/Company('${COMPANY}')/salesOrderLines`,
      {
        method: 'POST',
        headers: h,
        body: JSON.stringify(buildLinePayload(pos, documentId, (i + 1) * 10000)),
      }
    );
    if (!lineRes.ok) {
      const err = await lineRes.text();
      console.warn(`BC Zeile ${i + 1} Fehler: ${err}`);
    }
  }

  return { auftragsnummer, documentId };
}

export async function getSalesOrders(): Promise<any[]> {
  const h = await headers();
  const res = await fetch(
    `${BASE}/Company('${COMPANY}')/salesOrders?$orderby=orderDate desc&$top=50`,
    { headers: h }
  );
  if (!res.ok) throw new Error('Fehler beim Laden der Aufträge.');
  const data = await res.json();
  return data.value ?? [];
}
