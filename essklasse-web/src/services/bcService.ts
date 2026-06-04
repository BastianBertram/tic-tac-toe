import type { Bewirtungsbeleg } from '../types';

// ── Configure these for your BC environment ──────────────────────────────────
export const BC_CONFIG = {
  tenantId:  'YOUR_TENANT_ID',
  clientId:  'YOUR_CLIENT_ID',
  companyId: 'YOUR_BC_COMPANY_ID',
  baseUrl:   'https://api.businesscentral.dynamics.com/v2.0/YOUR_TENANT_ID/production/ODataV4',
};

export interface BCResult { auftragsnummer: string; documentId: string; }

export async function createSalesOrder(
  beleg: Bewirtungsbeleg,
  accessToken: string
): Promise<BCResult> {
  const h = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-Version': '4.0',
  };

  const orderRes = await fetch(
    `${BC_CONFIG.baseUrl}/Company('${BC_CONFIG.companyId}')/salesOrders`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        customerNo: beleg.konto,
        orderDate: beleg.cateringDatumVon,
        requestedDeliveryDate: beleg.cateringDatumVon,
        yourReference: beleg.veranstaltung,
        externalDocumentNo: beleg.id,
        shortcutDimension1Code: beleg.kostenstelle,
        shortcutDimension2Code: beleg.kostentraeger,
        // Custom extension fields:
        hwkBesteller: beleg.besteller,
        hwkVeranstaltung: beleg.veranstaltung,
        hwkOrt: beleg.ort,
        hwkRaum: beleg.raum,
        hwkPersonenzahl: beleg.personenzahl,
        hwkUhrzeitVon: beleg.uhrzeitVon,
        hwkUhrzeitBis: beleg.uhrzeitBis,
        hwkWuensche: beleg.wuensche,
        hwkInterneNotiz: beleg.interneNotiz,
      }),
    }
  );

  if (!orderRes.ok) throw new Error(`BC Fehler ${orderRes.status}: ${await orderRes.text()}`);
  const order = await orderRes.json();

  for (let i = 0; i < beleg.positionen.length; i++) {
    const p = beleg.positionen[i];
    await fetch(`${BC_CONFIG.baseUrl}/Company('${BC_CONFIG.companyId}')/salesOrderLines`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        documentId: order.id,
        lineNo: (i + 1) * 10000,
        type: 'Item',
        description: `[${p.kategorie}] ${p.bezeichnung}`,
        unitOfMeasureCode: p.einheit,
        unitPrice: p.preis,
        quantity: p.menge,
      }),
    });
  }

  return { auftragsnummer: order.number as string, documentId: order.id as string };
}
