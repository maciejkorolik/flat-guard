# Flat Rental Announcement Sources in Poland

Checked: 2026-03-28

This list prioritizes API or other systemic access for rental listings in major Polish cities such as Warsaw, Krakow, Wroclaw, Poznan, Lodz, Katowice, and the Tricity area.

## Source Matrix

| Source | Category | Access Type | Priority | Big-City Relevance | Notes |
| --- | --- | --- | --- | --- | --- |
| ASARI CRM / Galactica Virgo / ASGAL / LocumNet / IMO / EstiCRM | Upstream CRM / MLS | B2B integrations, exports, MLS feeds | High | High | Best upstream layer if commercial access is possible. These systems syndicate inventory to multiple portals and can reduce downstream scraping work. |
| Otodom | National portal | Partner API via CRM, XML feeds | High | High | Strongest national portal candidate. Official access appears partner-oriented rather than a public read API. |
| Gratka | National portal | WebAPI 2.0 for partners | High | High | Useful systemic source if partner access is available. Good candidate for agency and portal inventory. |
| Nieruchomosci-online.pl | National portal | NOE v2.0 exchange format, bilateral integrations | High | High | Strong city coverage and partner integration path. Likely more useful via agreements than as a public API. |
| OLX Nieruchomosci | Classifieds portal | Crawl, sitemap, possible unofficial `/api/v1/offers/` path | High | High | Best public engineering target if official partner access is not available. Treat as unofficial and subject to change. |
| Domy.pl | National portal | XML export | Medium | High | Worth including because it offers systemic export and broad city coverage. |
| Morizon | National portal | Crawl, partner-side integrations | Medium | High | Important secondary source. Expect overlap with Gratka. |
| Domiporta | National portal | Crawl, partner/import workflows | Medium | High | Large secondary portal. Good backfill source if higher-priority integrations are unavailable. |
| Trojmiasto.pl Ogłoszenia | Local portal | Crawl | Medium | Tricity only | Add specifically for Gdansk, Gdynia, and Sopot. Useful local supplement to national portals. |

## Recommended Acquisition Order

1. Upstream CRM / MLS vendors.
2. Otodom, Gratka, and Nieruchomosci-online partner routes.
3. OLX as the main public-system target.
4. Morizon, Domiporta, and Domy.pl for backfill.
5. Trojmiasto.pl for Tricity coverage.

## Practical Notes

- Expect significant duplication across national portals.
- Official interfaces are mostly partner or publisher integrations, not open public search APIs.
- For production use, confirm terms of service, robots rules, and personal-data handling before collecting contact data.
