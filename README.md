# Faida

Un mondo di caselle colorate. **Ogni pixel si espande a ogni passo nelle quattro
direzioni ortogonali**; dove l'espansione raggiunge un colore diverso avviene un
**incontro**, e una matrice dice cosa ne nasce. Ripetuto qualche centinaio di
volte, questo produce spirali, labirinti diagonali, continenti che si fondono, o
il silenzio.

Vive qui: **https://fithzhood.github.io/faida/faida.html**

## Da dove viene

Da [pastafariancode/Rock-Paper-Scissors](https://github.com/pastafariancode/Rock-Paper-Scissors),
uno script pygame che simulava 8 colori in una ruota fissa: rosso mangia arancio,
arancio mangia giallo, e così via fino a magenta che richiude su rosso. Nel gergo
dei modelli si chiama *automa cellulare ciclico*.

Riscritto in HTML/CSS/JS, con una differenza che cambia il modello.

## I tre stati di una casella

- **un colore** — si espande, e incontra
- **vuoto** — non fa niente e non oppone niente: qualunque colore lo occupa al
  passo dopo, senza bisogno di regole. È il terreno su cui il mondo cresce.
- **muro** — barriera inerte: non si espande, non viene occupato, non fa reagire
  nessuno. Serve a incanalare i fronti.

Vuoto e muro si somigliano solo a guardarli. Se semini tre macchie in una tela di
**muri** non succede niente — non c'è dove espandersi. In una tela di **vuoto**
le macchie crescono fino a toccarsi, e dove si toccano avviene l'incontro.

Se due colori diversi raggiungono la stessa casella vuota nello stesso passo,
l'incontro avviene lì: dalla casella nasce direttamente l'esito previsto.

## La differenza: cosa esce dall'incontro

Nell'originale un colore poteva solo **diventare il suo predatore**: l'esito di
ogni incontro era già deciso, ed era sempre uno dei due che si toccavano.

Qui ogni casella della matrice contiene due cose:

- **l'esito** `R[a][b]` — il colore che nasce dall'incontro fra `a` e `b`. Può
  essere `a`, può essere `b`, può essere **un terzo colore qualsiasi**, possono
  essere **macerie** (un muro), o niente.
- **la frequenza** `P[a][b]` — quanto spesso l'incontro riesce, da 0% a 100%.

Quindi *verde + rosso → viola* è una regola esprimibile: entrambe le caselle
diventano viola, perché ciascuna delle due si espande verso l'altra e trova
l'altro colore.

## La matrice è simmetrica, ed è giusto così

L'incontro è **commutativo**: fra verde e rosso succede una cosa sola, e non
dipende da chi si è espanso verso chi. Quindi `R[a][b] === R[b][a]` sempre — la
matrice è simmetrica **per costruzione**, non per disciplina: tocchi una casella
e la sua speculare si aggiorna con lei. Un incontro a due esiti diversi non è
rappresentabile, ed è esattamente ciò che si vuole.

**La predazione ci sta dentro senza sforzo**, ed è il punto che sembra
contraddittorio ma non lo è. L'incontro rosso-arancio produce *rosso*: applicato
alle due caselle, converte l'arancio e lascia il rosso com'è, perché un esito che
coincide con il colore già presente non cambia nulla. La ruota ciclica
dell'originale è quindi perfettamente simmetrica — basta leggerla come "chi vince
l'incontro" invece che "chi mangia chi", e infatti gira identica.

L'unica cosa che la commutatività esclude è la distruzione reciproca — *A e B si
mangiano a vicenda diventando ciascuno sé stesso* — perché sarebbero davvero due
esiti per un incontro solo. Al suo posto c'è lo schema **Cenere**, dove ciò che
resta dello scontro sono macerie per entrambi.

## Come si compone una regola

Nel pannello **Regole**, in tre gesti:

1. **l'esito** — scegli il colore che deve uscire (o il muro, o ∅ per cancellare)
2. **quanto spesso** — il cursore, da 5% a 100%
3. **tocca le caselle** — o sulla mappa in alto, o sulle caselle grandi in basso
   che mostrano la riga in lavorazione

Il pennello resta armato: scegli viola una volta e picchietti tutte le caselle
che devono dare viola. Sotto, una frase dice sempre cosa hai appena stabilito, e
distingue i due casi che contano:

- *"Verde + Rosso → diventano Viola tutti e due, sempre"*
- *"Rosso + Verde → vince Verde: il rosso diventa verde, sempre"*

Le scorciatoie: **tutta la riga**, **svuota riga**, **svuota tutto**.

## Gli schemi pronti

| schema | cosa succede |
|---|---|
| Ruota ciclica | l'originale: spirali e labirinti che non si assestano mai |
| Sasso-Carta-Forbici | tre colori, la versione minima |
| ...-Lucertola-Spock | cinque colori, ognuno ne batte due |
| Doppia ruota | ogni colore batte i due successivi |
| Gerarchia | il forte vince sempre: si estingue tutto in una decina di passi |
| Due fazioni | due blocchi che non si conquistano: al confine restano macerie |
| **Mescolanza** | dall'incontro esce la tinta a metà strada fra le due: nessuno vince, e vengono fuori continenti morbidi invece di spirali |
| **Alchimia** | reazioni sorteggiate, con terzi colori e cenere (muri che nascono dagli incontri) |
| Cenere | ogni incontro fra colori diversi lascia macerie: il mondo si cristallizza |
| Sorteggio | per ogni coppia vince uno dei due, a caso |
| Pace totale | matrice vuota, da riempire a mano |

## Le altre due stanze

- **Disegna** — scegli un colore, il **vuoto** o il **muro**, e trascina il dito
  sul mondo. **Svuota** ferma la simulazione e lascia una tela di vuoto: ci si
  disegna con calma la configurazione voluta e poi si preme avvia, e i colori si
  espandono. **Riempi col pennello** fa lo stesso con il colore scelto, se serve
  un fondo che partecipa invece che uno neutro.
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
- Partendo da poche macchie nel vuoto resta alto finché c'è vuoto da occupare,
  poi crolla: se i colori seminati non hanno regole fra loro, il mondo si divide
  in regioni e si ferma — viene fuori un diagramma di Voronoi.
- Quando arriva a 0 l'app si ferma da sola e **dice perché**: chi ha vinto, o
  quali coppie di colori si stanno toccando senza avere una regola. Quasi sempre
  la risposta a "perché non succede niente?" è quella — la ruota ciclica riempie
  8 coppie su 28, il resto della matrice è vuoto finché non lo riempi tu.
  *Mescolanza* e *Alchimia* invece le coprono tutte.

## Note tecniche

- Griglia in `Uint8Array`, disegno via `putImageData` su un canvas fuori schermo
  grande quanto la griglia, poi scalato senza interpolazione. Regge **109.000
  caselle a 60 passi al secondo** con il vicinato a 8 (l'originale ne faceva 144
  a 6 fps).
- Il mondo prende la forma dello spazio disponibile: non è quadrato.
- La dissolvenza fra un passo e l'altro usa una tabella di colori miscelati
  precalcolata (6 livelli × 13 stati × 13 stati).
- Le regole salvate dalle versioni precedenti vengono convertite al volo, e
  riportate a simmetria (dove i due sensi divergevano vince quello con la
  frequenza più alta).
- Nel preset *Mescolanza* i colori diametralmente opposti hanno **due** punti di
  mezzo sulla ruota: se ne prende sempre lo stesso, altrimenti la matrice non
  sarebbe simmetrica.
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
