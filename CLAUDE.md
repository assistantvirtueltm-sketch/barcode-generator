# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Webapp d'impression d'étiquettes codes-barres. L'utilisateur saisit un code (EAN-13 par
défaut) + un libellé produit ; l'app génère à la volée un PDF A4 imprimable d'une **planche
mono-produit** : 65 étiquettes identiques sur un support Apli/Agipa réf. 118990
(38 × 21,2 mm, 5 colonnes × 13 lignes), puis le télécharge.

Contraintes de cadrage (décidées, ne pas les réintroduire en question) :
- **Aucune base de données, aucune authentification, aucune API route.** Tout est client-side.
- La bibliothèque de produits (libellé + code + type de code) vit **uniquement dans le
  `localStorage`** du navigateur. Elle sert à régénérer un PDF à chaud sans ressaisie.
- Déploiement **Vercel** (zéro config, build statique/SSG — ne rien ajouter qui exige un runtime serveur).

## Stack

- Next.js (App Router) + TypeScript, Tailwind pour l'UI.
- `pdf-lib` pour construire le PDF en mémoire côté navigateur.
- `bwip-js` pour le rendu des codes-barres, en **vectoriel/haute résolution** — ne pas
  retomber sur un canvas rastérisé en PNG : des barres floues cassent la lecture en caisse.
- Tout code touchant `localStorage`, `pdf-lib` ou `bwip-js` doit être dans des composants
  `"use client"` (ou chargé dynamiquement), jamais exécuté au prerender.

## Commands

```bash
npm install
npm run dev            # serveur de dev local
npm run build          # build de production (ce que Vercel exécute)
npm run lint
npm run typecheck      # tsc --noEmit
npm test               # suite de tests
npm test -- <pattern>  # un seul fichier/test
```

## Géométrie de la planche (le cœur du projet)

Les dimensions sont la principale source de bugs : une erreur de 1 mm décale toute la
planche et rend le papier inutilisable. Règles :

- Centraliser **toutes** les cotes dans un unique module de layout (ex. `lib/label-layout.ts`),
  exprimées en millimètres, converties en points PDF (`mm * 72 / 25.4`) au dernier moment.
  Aucune valeur numérique de position en dur ailleurs dans le code.
- Géométrie Apli 118990 (compatible Avery L7651), qui boucle exactement sur 210 × 297 mm :
  - étiquette 38,0 × 21,2 mm ; 5 colonnes × 13 lignes = 65
  - marge gauche/droite 4,75 mm, gouttière horizontale 2,5 mm (pas de 40,5 mm)
  - marge haute/basse 10,7 mm, **aucune** gouttière verticale (pas de 21,2 mm)
- Le PDF ne doit contenir **ni traits de découpe ni fond** sur les étiquettes : le support est
  prédécoupé, toute encre hors zone est visible sur la planche.
- Prévoir une **page de calibration** (ou un décalage global X/Y réglable et persisté) :
  les imprimantes dérivent, et c'est le seul recours utilisateur face à un décalage matériel.
- Toute modification de ces cotes se vérifie sur un PDF réellement généré (mesurer), pas
  seulement à la lecture du diff.

## Validation des codes

Saisie **tolérante / multi-format** : EAN-13, EAN-8, UPC-A, Code128, avec détection du type.
- EAN-13 : accepter 13 chiffres (clé de contrôle vérifiée, erreur explicite si fausse) ou
  12 chiffres (clé calculée automatiquement et affichée).
- Le type détecté est stocké avec le produit et repassé à `bwip-js` ; ne jamais redeviner le
  type au moment de générer le PDF.
- La validation vit dans un module pur, testé unitairement (checksums, longueurs, cas limites) —
  c'est la logique la plus rentable à couvrir par des tests.

## Persistance

- Un seul module d'accès au `localStorage`, avec un numéro de **version de schéma** et une
  migration à la lecture : les données utilisateur ne sont nulle part ailleurs, une lecture
  naïve d'un ancien format les efface.
- Toute lecture/écriture est enveloppée dans un `try/catch` (mode privé, quota, storage bloqué) :
  l'app doit rester utilisable sans persistance.
- Prévoir export/import JSON de la bibliothèque — c'est la seule sauvegarde possible sans backend.
