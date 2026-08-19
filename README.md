# Faida

Un mondo di colori che si conquistano a vicenda. Ogni casella guarda i vicini: se
accanto c'è un colore che la **preda**, cambia bandiera. Ripetuto qualche centinaio
di volte, questo produce spirali, labirinti diagonali e fronti d'onda che non si
fermano mai.

Vive qui: **https://fithzhood.github.io/faida/faida.html**

## Da dove viene

Da [pastafariancode/Rock-Paper-Scissors](https://github.com/pastafariancode/Rock-Paper-Scissors),
uno script pygame che simulava 8 colori disposti in una ruota fissa: rosso mangia
arancio, arancio mangia giallo, e così via fino a magenta che richiude su rosso.
Nel gergo dei modelli si chiama *automa cellulare ciclico*.

Riscritto qui in HTML/CSS/JS, con una differenza che cambia tutto.

## La differenza: la matrice

Nell'originale le relazioni erano cablate nel codice e **cicliche**: ogni colore
aveva una preda sola, la successiva della ruota.

Qui c'è una **matrice**: `M[attaccante][difensore]` = la probabilità, da 0% a 100%,
che un vicino di quel colore converta quella casella. Ogni coppia è indipendente
dalle altre, e i due versi sono indipendenti fra loro. Quindi per qualunque coppia
di colori si può dire:

| relazione | com'è fatta |
|---|---|
| **vittoria** | A → B al 100%, B → A a 0 |
| **sconfitta** | il contrario |
| **indifferenza** | entrambi a 0: si sfiorano e non succede nulla |
| **reciproca** | entrambi > 0: si divorano a vicenda, e vince chi ha la percentuale più alta |
| **incerta** | qualunque valore intermedio: 30% vuol dire che tre contatti su dieci convertono |

La ruota ciclica dell'originale è solo uno degli schemi possibili — quello che si
carica all'avvio.

## Come si usa

La barra in basso: **avvia/pausa**, **passo** singolo, **rigenera** il mondo, e i tre
pannelli.

- **Regole** — la matrice come mappa (riga = chi attacca, colonna = chi subisce),
  la coppia selezionata con i due cursori di probabilità, e quattro scorciatoie:
  *A vince*, *B vince*, *reciproco*, *indifferenti*. In fondo gli schemi pronti.
- **Disegna** — scegli un colore (o il **muro**, che non attacca e non è attaccabile)
  e trascina il dito sul mondo. Serve per costruire barriere e vedere come si
  incanalano i fronti.
- **Mondo** — quanti colori (2-12), quanto è fitta la griglia, la velocità, il
  vicinato a 4 o a 8, i bordi che si richiudono, e la tavolozza.

Da tastiera: `spazio` avvia/ferma, `n` o `→` avanza di un passo, `r` rigenera,
`esc` chiude il pannello.

Le regole e le impostazioni si salvano da sole nel browser.

## Gli schemi pronti

| schema | cosa succede |
|---|---|
| Ruota ciclica | l'originale: spirali e labirinti che non si assestano mai |
| Sasso-Carta-Forbici | tre colori, la versione minima |
| ...-Lucertola-Spock | cinque colori, ognuno ne batte due |
| Doppia ruota | ogni colore batte i due successivi |
| Gerarchia | il forte vince sempre: si estingue tutto in pochi passi |
| Due fazioni | guerra di confine fra due blocchi |
| Distruzione reciproca | tutti contro tutti al 45% |
| Sorteggio | relazioni a caso: quasi sempre qualcosa di inatteso |
| Pace totale | matrice vuota, da riempire a mano |

## Il numero che vale la pena guardare

In alto c'è **attrito**: la percentuale di caselle che hanno cambiato colore
nell'ultimo passo. Con la ruota ciclica, dopo un centinaio di passi si stabilizza
al **100%** — ogni singola casella cambia colore a ogni passo, eppure la figura
sullo schermo sembra ferma. Non è ferma: è un'onda che trasla, e la struttura è
l'unica cosa che resta al suo posto.

Quando l'attrito arriva a 0 l'app si ferma da sola e lo dice: qualcuno ha vinto,
oppure i sopravvissuti sono indifferenti fra loro.

## Note tecniche

- La griglia è un `Uint8Array`, il disegno passa da `putImageData` su un canvas
  fuori schermo grande quanto la griglia, poi scalato senza interpolazione. Regge
  109.000 caselle a 60 passi al secondo con il vicinato a 8.
- Il mondo prende la forma dello spazio disponibile: non è quadrato, si allunga
  come lo schermo.
- La dissolvenza fra un passo e l'altro usa una tabella di colori miscelati
  precalcolata (6 livelli × 13 stati × 13 stati), così il fondersi dei colori non
  costa moltiplicazioni per casella.
- Nessuna dipendenza esterna. Tre file.

## File

`faida.html`, `faida.css`, `faida.js` — e basta. Le prove di collaudo stanno in
`shots/` nella cartella di lavoro (`OneDrive\Documenti\app\faida`), non nel repo.
