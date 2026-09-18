# Gabarit Apli/Agipa 118990 — cotes relevées

Source autoritaire des cotes de la planche : `apli-118990-gabarit.doc`, le
gabarit Word fourni par le fabricant (Word 97, tableau de 13 lignes × 5
colonnes). Les valeurs ci-dessous ont été extraites des structures binaires du
document (1 mm = 1440/25,4 = 56,6929 twips) :

| Propriété | Valeur relevée | En mm |
| --- | --- | --- |
| `sprmSXaPage` (largeur page) | 11934 twips | 210,50 |
| `sprmSYaPage` (hauteur page) | 16866 twips | 297,50 |
| `sprmSDxaLeft` (marge gauche) | 567 twips | 10,00 |
| `sprmSDyaTop` (marge haute) | 607 twips | 10,71 |
| `sprmTDefTable` (bornes de colonnes) | −8, 2146, 4301, 6455, 8609, 10764 twips | −0,14 … 189,87 |
| `sprmTDyaRowHeight` (×13, hauteur exacte) | −1202 twips | 21,20 |

Conclusions retenues dans `lib/label-layout.ts` :

- Étiquette 38,0 × 21,2 mm, **5 colonnes jointives** : le pas horizontal vaut la
  largeur de l'étiquette, il n'y a **aucune gouttière** (ni horizontale, ni
  verticale).
- La matrice mesure donc 190 × 275,6 mm et elle est **centrée** sur la feuille :
  le centrage sur une A4 réelle (210 × 297) redonne 10,0 mm de marge gauche et
  10,7 mm de marge haute, soit les marges du gabarit.
- Le gabarit décale sa table de −8 twips (0,14 mm) : c'est la compensation de
  bordure propre au rendu des tableaux Word, pas une cote du massicot. Elle est
  ignorée, et le test `colle aux bornes en twips du gabarit`
  (`lib/label-layout.test.ts`) la tolère explicitement.
- Le gabarit décrit une page de 210,5 × 297,5 mm ; cet écart d'un demi-millimètre
  est un arrondi de l'outil d'origine. Le PDF reste en A4 exacte.

⚠️ Ne pas reprendre les cotes de la matrice **Avery L7651**, qui utilise les
mêmes étiquettes 38 × 21,2 mm mais avec un pas de 40,6 mm (gouttières de
2,6 mm) : ce pas décale les colonnes extérieures de plus de 5 mm et les fait
déborder du support.

## Relire le gabarit

LibreOffice refuse ce fichier ; les cotes se relisent directement dans les flux
OLE (`pip install olefile`) en cherchant les opcodes sprm ci-dessus dans le flux
`WordDocument` — les valeurs sont des entiers signés 16 bits qui suivent
l'opcode sur 2 octets.
