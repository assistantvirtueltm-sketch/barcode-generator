# Planches d'étiquettes codes-barres

Webapp d'impression d'étiquettes codes-barres. On saisit un libellé produit et un
code (EAN-13, EAN-8, UPC-A ou Code 128), l'app génère un **PDF A4 vectoriel** :
une planche mono-produit de 65 étiquettes identiques au format
**Apli/Agipa 118990** (38 × 21,2 mm), à télécharger et imprimer.

- Aucune base de données, aucune authentification, aucun appel réseau : tout est
  calculé dans le navigateur.
- La bibliothèque de produits est mémorisée dans le `localStorage` pour
  régénérer un PDF à la volée, sans ressaisie. Export/import JSON pour la
  sauvegarder ou la transférer.
- Codes-barres **vectoriels** (rectangles PDF), donc nets à toutes les
  résolutions d'impression.

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # suite de tests (Vitest)
npm run lint
npm run typecheck
npm run build      # export statique dans out/
```

## Impression

1. Choisir le produit, éventuellement la première étiquette libre (planche
   entamée) et le nombre d'étiquettes.
2. Télécharger le PDF, puis l'imprimer **à 100 %** : dans la boîte de dialogue
   d'impression, choisir « Taille réelle » / « 100 % » et **désactiver**
   « Ajuster à la page », sinon toute la planche est décalée.
3. En cas de décalage résiduel de l'imprimante, imprimer la *planche de
   calibration* sur papier ordinaire, la superposer au support adhésif, puis
   régler le décalage X/Y (mémorisé).

## Déploiement

Export statique (`output: "export"`) : Vercel détecte Next.js et sert `out/`
sans configuration, aucun runtime serveur n'est requis.
