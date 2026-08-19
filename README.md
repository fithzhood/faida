# Faida

Un mondo di caselle colorate che reagiscono a contatto. Ogni casella guarda i
vicini: se una regola dice che da quell'incontro esce qualcosa, cambia colore.
Ripetuto qualche centinaio di volte, questo produce spirali, labirinti diagonali,
continenti che si fondono, o il silenzio.

Vive qui: **https://fithzhood.github.io/faida/faida.html**

## Da dove viene

Da [pastafariancode/Rock-Paper-Scissors](https://github.com/pastafariancode/Rock-Paper-Scissors),
uno script pygame che simulava 8 colori in una ruota fissa: rosso mangia arancio,
arancio mangia giallo, e così via fino a magenta che richiude su rosso. Nel gergo
dei modelli si chiama *automa cellulare ciclico*.

Riscritto in HTML/CSS/JS, con una differenza che cambia il modello.

## La differenza: cosa esce dall'incontro

Nell'originale un colore poteva solo **diventare il suo predatore**: l'esito di
ogni incontro era già deciso, ed era sempre uno dei due che si toccavano.

Qui ogni casella della matrice contiene due cose:

- **l'esito** `R[a][d]` — quale colore diventa una casella `d` toccata da un
  vicino `a`. Può essere `a`, può essere `d`, può essere **un terzo colore
  qualsiasi**, può essere un **muro**, o niente.
- **la frequenza** `P[a][d]` — quanto spesso succede, da 0% a 100%.

Quindi *verde + rosso → viola* è una regola esprimibile, e con un tocco su
"anche al contrario" lo diventano tutti e due. La predazione della ruota
originale è il caso particolare in cui `R[a][d] = a`.

Nota sull'orientamento della matrice: **la riga è il vicino che arriva, la
colonna è la casella che subisce**. Le due caselle simmetriche sono indipendenti:
`R[verde][rosso]` dice cosa diventa il rosso, `R[rosso][verde]` cosa diventa il
verde. Si possono impostare diverse — uno dei due muta e l'altro no.

## Come si compone una regola

Nel pannello **Regole**, in tre gesti:

1. **l'esito** — scegli il colore che deve uscire (o il muro, o ∅ per cancellare)
2. **quanto spesso** — il cursore, da 5% a 100%
3. **tocca le caselle** — o sulla mappa in alto, o sulle caselle grandi in basso
   che mostrano la riga in lavorazione

Il pennello resta armato: scegli viola una volta e picchietti tutte le caselle
che devono dare viola. Sotto, una frase dice sempre cosa hai appena stabilito —
*"Verde e Rosso si toccano e diventano Viola tutti e due, sempre"*.

Le scorciatoie: **anche al contrario** (specchia l'ultima casella), **tutta la
riga**, **svuota riga**, **svuota tutto**.

## Gli schemi pronti

| schema | cosa succede |
|---|---|
| Ruota ciclica | l'originale: spirali e labirinti che non si assestano mai |
| Sasso-Carta-Forbici | tre colori, la versione minima |
| ...-Lucertola-Spock | cinque colori, ognuno ne batte due |
| Doppia ruota | ogni colore batte i due successivi |
| Gerarchia | il forte vince sempre: si estingue tutto in una decina di passi |
| Due fazioni | guerra di confine fra due blocchi |
| **Mescolanza** | dall'incontro esce la tinta a metà strada fra le due: nessuno vince, e vengono fuori continenti morbidi invece di spirali |
| **Alchimia** | reazioni sorteggiate, con terzi colori e cenere (muri che nascono dagli incontri) |
| Distruzione reciproca | tutti contro tutti al 45% |
| Sorteggio | relazioni predatorie a caso |
| Pace totale | matrice vuota, da riempire a mano |

## Le altre due stanze

- **Disegna** — scegli un colore (o il **muro**, che non reagisce e non fa
  reagire) e trascina il dito sul mondo. **Svuota** ferma la simulazione e
  lascia una tela di soli muri: ci si disegna con calma la configurazione
  voluta e poi si preme avvia. **Riempi col pennello** fa lo stesso ma con il
  colore scelto, se serve un fondo che partecipa invece di uno inerte.
- **Mondo** — quanti colori (2-12), quanto è fitta la griglia, la velocità, il
  vicinato a 4 o a 8, i bordi che si richiudono, e la tavolozza.

Da tastiera: `spazio` avvia/ferma, `n` o `→` avanza di un passo, `r` rigenera,
`esc` chiude il pannello. Tutto si salva da solo nel browser.

## Il numero che vale la pena guardare

In alto c'è **attrito**: la percentuale di caselle che cambiano colore a ogni
passo. Racconta il regime in cui si trova il mondo meglio di qualsiasi immagine.

- Con la **ruota ciclica** si stabilizza al **100%** e ci resta: ogni singola
  casella cambia colore a ogni passo, eppure la figura sullo schermo sembra
  ferma. Non è ferma — è un'onda che trasla, e la struttura è l'unica cosa che
  resta al suo posto.
- Con la **mescolanza** si assesta intorno al 38%: i continenti si muovono solo
  ai bordi.
- Quando arriva a 0 l'app si ferma da sola e lo dice: qualcuno ha vinto, oppure
  i sopravvissuti non si fanno più niente.

## Note tecniche

- Griglia in `Uint8Array`, disegno via `putImageData` su un canvas fuori schermo
  grande quanto la griglia, poi scalato senza interpolazione. Regge **109.000
  caselle a 60 passi al secondo** con il vicinato a 8 (l'originale ne faceva 144
  a 6 fps).
- Il mondo prende la forma dello spazio disponibile: non è quadrato.
- La dissolvenza fra un passo e l'altro usa una tabella di colori miscelati
  precalcolata (6 livelli × 13 stati × 13 stati).
- Le regole salvate in versione 1 (solo predazione) vengono convertite al volo
  al nuovo formato.
- Nessuna dipendenza esterna. Tre file.

## Vincoli di interfaccia, già pagati

Con 8 colori una matrice 9×9 **non può** avere caselle da 44px in 375px di
schermo. Perciò la matrice è una **mappa** — si legge a colpo d'occhio e si può
picchiettare — mentre ogni azione è raggiungibile anche dai controlli grandi
sotto, che restano sempre sopra i 44px e vanno a capo da soli quando i colori
aumentano. Collaudata con `banco.js` a 360×800 e 375×812, dentro ogni pannello.

## File

`faida.html`, `faida.css`, `faida.js` — e basta. Le prove di collaudo stanno in
`shots/` nella cartella di lavoro (`OneDrive\Documenti\app\faida`), non nel repo.
