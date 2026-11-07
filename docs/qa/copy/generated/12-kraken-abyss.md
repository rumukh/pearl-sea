# Krakatičí propast (kraken-abyss, 4. třída)

## kraken-abyss.1: Podmět a přísudek

### analysis: sk.kraken.member (Podmět, nebo přísudek?), classify, 28 položek

- urči member: «Delfín» skáče
  volby: podmět | přísudek · správně: podmět
  nápověda: —
- urči member: V zátoce plavou «ryby»
  volby: podmět | přísudek · správně: podmět
  nápověda: —
  ⚠ tvar «ryby» mají buňky sg2, pl1, pl4, pl5: rozhodne věta?
- urči member: Želvy pomalu «lezou» na pláž
  volby: podmět | přísudek · správně: přísudek
  nápověda: —
- urči member: Racci «křičí» nad přístavem
  volby: podmět | přísudek · správně: přísudek
  nápověda: —
  ⚠ tvar «křičí» mají buňky pres3, pres6: rozhodne věta?
- urči member: «Hledáš» na pláži mušle
  volby: podmět | přísudek · správně: přísudek
  nápověda: —

## kraken-abyss.2: Shoda přísudku s podmětem

### ink-sentence: sk.kraken.agreement (Shoda přísudku s podmětem), spell.sentence, 18 položek

- věta agree.01: Delfíni skákal[1] přes vlny.
  [1] správně «i» · volby: y | i · klávesy: i y a · shoda (skákat)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
  ⚠ «skákaly» je také slovo lexikonu: rozhodne věta?
- věta agree.04: Krabi lezl[1] po kamenech.
  [1] správně «i» · volby: y | i · klávesy: i y a · shoda (lézt)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
  ⚠ «lezly» je také slovo lexikonu: rozhodne věta?
- věta agree.08: Ostrovy zmizel[1] v mlze.
  [1] správně «y» · volby: i | y · klávesy: i y a · shoda (zmizet)
  nápověda: ti, ty, nebo ta? (rod mužský neživotný, množné číslo)
  ⚠ «zmizeli» je také slovo lexikonu: rozhodne věta?
- věta agree.11: Želvy a ryby plaval[1] k útesu.
  [1] správně «y» · volby: y | i · klávesy: i y a · shoda (plavat)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.
  ⚠ «plavali» je také slovo lexikonu: rozhodne věta?
- věta agree.15: Racci a tučňáci lovil[1] ryby.
  [1] správně «i» · volby: i | y · klávesy: i y a · shoda (lovit)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.
  ⚠ «lovily» je také slovo lexikonu: rozhodne věta?

### bug-hunt: sk.kraken.agreement-mistakes (Lov chyb: shoda přísudku s podmětem), spell.mistake, 18 položek

- lov chyb (agree.01): Delfíni ~skákaly~ přes vlny.
  oprava skákal[ ]: správně «i» · volby: i | y · klávesy: i y a · shoda (skákat)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
- lov chyb (agree.04): Krabi ~lezly~ po kamenech.
  oprava lezl[ ]: správně «i» · volby: i | y · klávesy: i y a · shoda (lézt)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
- lov chyb (agree.08): Ostrovy ~zmizeli~ v mlze.
  oprava zmizel[ ]: správně «y» · volby: i | y · klávesy: i y a · shoda (zmizet)
  nápověda: ti, ty, nebo ta? (rod mužský neživotný, množné číslo)
- lov chyb (agree.11): Želvy a ryby ~plavali~ k útesu.
  oprava plaval[ ]: správně «y» · volby: i | y · klávesy: i y a · shoda (plavat)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.
- lov chyb (agree.15): Racci a tučňáci ~lovily~ ryby.
  oprava lovil[ ]: správně «i» · volby: y | i · klávesy: i y a · shoda (lovit)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.

### analysis: sk.kraken.gender-class (Rod a životnost podmětu), classify, 24 položek

- urči gender-class: «Delfíni» skákali přes vlny
  volby: rod mužský životný | rod mužský neživotný | rod ženský | rod střední · správně: rod mužský životný
  nápověda: ten, ta, nebo to? (rod mužský životný)
  ⚠ tvar «Delfíni» mají buňky pl1, pl5: rozhodne věta?
- urči gender-class: «Racci» křičeli nad mořem
  volby: rod mužský životný | rod mužský neživotný | rod ženský | rod střední · správně: rod mužský životný
  nápověda: ten, ta, nebo to? (rod mužský životný)
  ⚠ tvar «Racci» mají buňky pl1, pl5: rozhodne věta?
- urči gender-class: Delfíni a «želvy» plavali spolu
  volby: rod mužský životný | rod mužský neživotný | rod ženský | rod střední · správně: rod ženský
  nápověda: ten, ta, nebo to? (rod ženský)
  ⚠ tvar «želvy» mají buňky sg2, pl1, pl4, pl5: rozhodne věta?
- urči gender-class: «Chlapci» a dívky se koupali v moři
  volby: rod mužský životný | rod mužský neživotný | rod ženský | rod střední · správně: rod mužský životný
  nápověda: ten, ta, nebo to? (rod mužský životný)
  ⚠ tvar «Chlapci» mají buňky sg3, sg6, pl1, pl5, pl7: rozhodne věta?
- urči gender-class: Racci a «tučňáci» lovili ryby
  volby: rod mužský životný | rod mužský neživotný | rod ženský | rod střední · správně: rod mužský životný
  nápověda: ten, ta, nebo to? (rod mužský životný)
  ⚠ tvar «tučňáci» mají buňky pl1, pl5: rozhodne věta?

## kraken-abyss.3: Věta jednoduchá, souvětí a spojky

### analysis: sk.kraken.clauses (Věta jednoduchá, nebo souvětí?), classify, 36 položek

- urči clauses: Delfín skáče přes vlny.
  volby: věta jednoduchá | souvětí · správně: věta jednoduchá
  nápověda: —
- urči clauses: Želva plave pomalu, ale vytrvale.
  volby: věta jednoduchá | souvětí · správně: věta jednoduchá
  nápověda: —
- urči clauses: Malá rybka plakala, protože ztratila mušli.
  volby: věta jednoduchá | souvětí · správně: souvětí
  nápověda: —
- urči clauses: Delfín skáče.
  volby: věta jednoduchá | souvětí · správně: věta jednoduchá
  nápověda: —
- urči clauses: Racci křičí nad přístavem.
  volby: věta jednoduchá | souvětí · správně: věta jednoduchá
  nápověda: —

### ink-sentence: sk.ice.conjunctions (Spojky v souvětí), spell.sentence, 8 položek

- věta conj.01: Foukal silný vítr, [1] delfíni skákali dál.
  [1] správně «ale» · volby: protože | ale · klávesy: ale protože · spojka (ale)
  nápověda: Spojka spojuje věty v souvětí. Vyber tu, která se k oběma větám hodí.
  ⚠ «protože» je také slovo lexikonu: rozhodne věta?
- věta conj.02: Malá rybka plakala, [1] ztratila mušli.
  [1] správně «protože» · volby: ale | protože · klávesy: ale protože · spojka (protože)
  nápověda: Spojka spojuje věty v souvětí. Vyber tu, která se k oběma větám hodí.
  ⚠ «ale» je také slovo lexikonu: rozhodne věta?
- věta conj.04: Rybář věděl, [1] přijde bouřka.
  [1] správně «že» · volby: protože | že · klávesy: protože že · spojka (že)
  nápověda: Spojka spojuje věty v souvětí. Vyber tu, která se k oběma větám hodí.
  ⚠ «protože» je také slovo lexikonu: rozhodne věta?
- věta conj.05: Krab plaval ke břehu, [1] vlny ho vracely zpátky.
  [1] správně «ale» · volby: ale | protože · klávesy: ale protože · spojka (ale)
  nápověda: Spojka spojuje věty v souvětí. Vyber tu, která se k oběma větám hodí.
  ⚠ «protože» je také slovo lexikonu: rozhodne věta?
- věta conj.07: Mrož Vousáč řekl, [1] zítra otevře obchod.
  [1] správně «že» · volby: že | protože · klávesy: protože že · spojka (že)
  nápověda: Spojka spojuje věty v souvětí. Vyber tu, která se k oběma větám hodí.
  ⚠ «protože» je také slovo lexikonu: rozhodne věta?

### ink-sentence: sk.ice.end-marks (Znaménko na konci věty), spell.sentence, 14 položek

- věta kind.06: Kde bydlí malá chobotnice[1]
  [1] správně «?» · volby: . | ? · klávesy: . ? · interpunkce
  nápověda: Věta oznamovací končí tečkou, tázací otazníkem, rozkazovací a přací obvykle vykřičníkem.
- věta kind.08: Proč racci křičí nad přístavem[1]
  [1] správně «?» · volby: ? | . · klávesy: . ? · interpunkce
  nápověda: Věta oznamovací končí tečkou, tázací otazníkem, rozkazovací a přací obvykle vykřičníkem.
- věta kind.12: Plav rychle ke břehu[1]
  [1] správně «!» · volby: ! | ? · klávesy: ? ! · interpunkce
  nápověda: Věta oznamovací končí tečkou, tázací otazníkem, rozkazovací a přací obvykle vykřičníkem.
- věta kind.15: Hledej perlu pod velkým kamenem[1]
  [1] správně «!» · volby: ! | ? · klávesy: ? ! · interpunkce
  nápověda: Věta oznamovací končí tečkou, tázací otazníkem, rozkazovací a přací obvykle vykřičníkem.
- věta kind.18: Kéž by delfíni připluli až k nám[1]
  [1] správně «!» · volby: ? | ! · klávesy: ? ! · interpunkce
  nápověda: Věta oznamovací končí tečkou, tázací otazníkem, rozkazovací a přací obvykle vykřičníkem.

### fishing-nets: sk.kraken.nets-conjunctions (Sítě: spojky a předložky)

## kraken-abyss.4: Velké opakování: pravopis

### feeding: sk.kraken.listed-grade4 (Vyjmenovaná slova a slova příbuzná), spell.word, 93 položek

- slovo: bl[1]skat se
  [1] správně «ý» · volby: ý | í · klávesy: i í y ý · vyjm (blýskat se)
  nápověda: Uvnitř slova píšeme po obojetné souhlásce y/ý jen ve vyjmenovaných slovech a ve slovech příbuzných.
- slovo: kob[1]la
  [1] správně «y» · volby: y | i · klávesy: i í y ý · vyjm (kobyla)
  nápověda: Uvnitř slova píšeme po obojetné souhlásce y/ý jen ve vyjmenovaných slovech a ve slovech příbuzných.
- slovo: nedosl[1]chavý
  [1] správně «ý» · volby: í | ý · klávesy: i í y ý · vyjm (nedoslýchavý)
  nápověda: příbuzné vyjmenované slovo, třeba bydlení → bydlit
- slovo: p[1]tel
  [1] správně «y» · volby: i | y · klávesy: i í y ý · vyjm (pytel)
  nápověda: Uvnitř slova píšeme po obojetné souhlásce y/ý jen ve vyjmenovaných slovech a ve slovech příbuzných.
- slovo: s[1]r
  [1] správně «ý» · volby: í | ý · klávesy: i í y ý · vyjm (sýr)
  nápověda: Uvnitř slova píšeme po obojetné souhlásce y/ý jen ve vyjmenovaných slovech a ve slovech příbuzných.

### feeding: sk.kraken.review-spelling (Opakování: pravopis 4. třídy), spell.word, 25 položek

- slovo: be[1]pečí
  [1] správně «z» · volby: s | z · klávesy: s z · predpona-souhlaska (bezpečí)
  nápověda: Předpony od-, nad-, pod-, před- končí vždy na d, předpony roz- a bez- vždy na z, i když slyšíme t nebo s. Například: nadpis, odpočinek.
- slovo: náv[1]k
  [1] správně «y» · volby: i | y · klávesy: i í y ý · vyjm (návyk)
  nápověda: příbuzné vyjmenované slovo, třeba bydlení → bydlit
- slovo: ob[1]t
  [1] správně «je» · volby: ě | je · klávesy: e é ě je · bje-vje (objet)
  nápověda: Skupiny bje a vje píšeme tam, kde se předpona ob- nebo v- potká s kořenem, který začíná na j. Například: objem, objev.
- slovo: přep[1]ch
  [1] správně «y» · volby: i | y · klávesy: i í y ý · vyjm (přepych)
  nápověda: příbuzné vyjmenované slovo, třeba bydlení → bydlit
- slovo: sl[1]šitelný
  [1] správně «y» · volby: y | i · klávesy: i í y ý · vyjm (slyšitelný)
  nápověda: příbuzné vyjmenované slovo, třeba bydlení → bydlit

### ink-sentence: sk.kraken.review-sentences (Opakování: pravopis ve větách), spell.sentence, 45 položek

- věta agree.01: Delfíni skákal[1] přes vlny.
  [1] správně «i» · volby: i | y · klávesy: i y a · shoda (skákat)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
  ⚠ «skákaly» je také slovo lexikonu: rozhodne věta?
- věta agree.10: Delfíni a želvy plaval[1] spolu.
  [1] správně «i» · volby: i | y · klávesy: i y a · shoda (plavat)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.
  ⚠ «plavaly» je také slovo lexikonu: rozhodne věta?
- věta alike.16: Piráti dob[1]li starý hrad.
  [1] správně «y» · volby: i | y · klávesy: i í y ý · vyjm (dobýt)
  nápověda: příbuzné vyjmenované slovo, třeba jazýček → jazyk
  ⚠ «dobili» je také slovo lexikonu: rozhodne věta?
- věta prefix.01: Rybka [1] [2].
  [1] správně «odplavala» · volby: odplavala | od plavala · klávesy: od plavala odplavala · predpona-predlozka (odplavat)
  nápověda: Předponu píšeme se slovem dohromady, předložku zvlášť. Například: podplula, do zátoky.
  [2] správně «od břehu» · volby: od břehu | odbřehu · klávesy: od břehu odbřehu · predpona-predlozka
  nápověda: Předponu píšeme se slovem dohromady, předložku zvlášť. Například: podplula, do zátoky.
- věta prefix.07: Lachtan [1] tuleně.
  [1] správně «předběhl» · volby: předběhl | před běhl · klávesy: před běhl předběhl · predpona-predlozka (předběhnout)
  nápověda: Předponu píšeme se slovem dohromady, předložku zvlášť. Například: odplavala, od břehu.

### bug-hunt: sk.kraken.review-mistakes (Lov chyb: pravopis 4. třídy), spell.mistake, 62 položek

- lov chyb (agree.01): Delfíni ~skákaly~ přes vlny.
  oprava skákal[ ]: správně «i» · volby: y | i · klávesy: i y a · shoda (skákat)
  nápověda: ti, ty, nebo ta? (rod mužský životný, množné číslo)
- lov chyb (agree.13): Chlapci a dívky se ~koupaly~ v moři.
  oprava koupal[ ]: správně «i» · volby: i | y · klávesy: i y a · shoda (koupat se)
  nápověda: Je-li v podmětu aspoň jedno podstatné jméno rodu mužského životného, píšeme -i: psi a kočky utíkali. Jsou-li všechna rodu středního, píšeme -a. Jinak píšeme -y.
- lov chyb (e-caron.41): Vidíš ~mně~ pod vodou?
  oprava [ ]: správně «mě» · volby: mě | mně · klávesy: mě mně · mne-zajmeno (já)
  nápověda: 4. pád: koho? co?
- lov chyb (prefix.07): Lachtan ~před běhl~ tuleně.
  oprava [ ]: správně «předběhl» · volby: před běhl | předběhl · klávesy: před běhl předběhl · predpona-predlozka (předběhnout)
  nápověda: Předponu píšeme se slovem dohromady, předložku zvlášť. Například: odplavala, od břehu.
- lov chyb (e-caron.28): Velryba má obrovský ~oběm~ plic.
  oprava ob[ ]m: správně «je» · volby: je | ě · klávesy: e é ě je · bje-vje (objem)
  nápověda: Skupiny bje a vje píšeme tam, kde se předpona ob- nebo v- potká s kořenem, který začíná na j. Například: objev, vjezd.

## kraken-abyss.5: Velké opakování: mluvnice

### analysis: sk.trench.pattern-all (Všech 14 vzorů), classify, 42 položek

- urči pattern: chobotnice
  volby: pán | hrad | muž | stroj | předseda | soudce | žena | růže | píseň | kost | město | moře | kuře | stavení · správně: růže
  nápověda: Urči rod: ten, ta, nebo to? U rodu mužského urči i životnost. Pak porovnej 1. a 2. pád se vzory.
- urči pattern: lano
  volby: pán | hrad | muž | stroj | předseda | soudce | žena | růže | píseň | kost | město | moře | kuře | stavení · správně: město
  nápověda: Urči rod: ten, ta, nebo to? U rodu mužského urči i životnost. Pak porovnej 1. a 2. pád se vzory.
- urči pattern: ostrov
  volby: pán | hrad | muž | stroj | předseda | soudce | žena | růže | píseň | kost | město | moře | kuře | stavení · správně: hrad
  nápověda: Urči rod: ten, ta, nebo to? U rodu mužského urči i životnost. Pak porovnej 1. a 2. pád se vzory.
- urči pattern: rybář
  volby: pán | hrad | muž | stroj | předseda | soudce | žena | růže | píseň | kost | město | moře | kuře | stavení · správně: muž
  nápověda: Urči rod: ten, ta, nebo to? U rodu mužského urči i životnost. Pak porovnej 1. a 2. pád se vzory.
- urči pattern: tuleň
  volby: pán | hrad | muž | stroj | předseda | soudce | žena | růže | píseň | kost | město | moře | kuře | stavení · správně: muž
  nápověda: Urči rod: ten, ta, nebo to? U rodu mužského urči i životnost. Pak porovnej 1. a 2. pád se vzory.

### analysis: sk.storm.verb-form (Tvar jednoduchý, nebo složený?), classify, 29 položek

- urči verb-form: budu plavat
  volby: tvar jednoduchý | tvar složený · správně: tvar složený
  nápověda: Kolik slov má tvar? Jednoduchý tvar je jedno slovo: maluje, maloval. Složený tvar má víc slov: budu malovat, maloval jsem, maloval bych.
- urči verb-form: budou plavat
  volby: tvar jednoduchý | tvar složený · správně: tvar složený
  nápověda: Kolik slov má tvar? Jednoduchý tvar je jedno slovo: maluje, maloval. Složený tvar má víc slov: budu malovat, maloval jsem, maloval bych.
- urči verb-form: plavali
  volby: tvar jednoduchý | tvar složený · správně: tvar jednoduchý
  nápověda: Kolik slov má tvar? Jednoduchý tvar je jedno slovo: maluje, maloval. Složený tvar má víc slov: budu malovat, maloval jsem, maloval bych.
- urči verb-form: plavou
  volby: tvar jednoduchý | tvar složený · správně: tvar jednoduchý
  nápověda: Kolik slov má tvar? Jednoduchý tvar je jedno slovo: maluje, maloval. Složený tvar má víc slov: budu malovat, maloval jsem, maloval bych.
- urči verb-form: skočili
  volby: tvar jednoduchý | tvar složený · správně: tvar jednoduchý
  nápověda: Kolik slov má tvar? Jednoduchý tvar je jedno slovo: maluje, maloval. Složený tvar má víc slov: budu malovat, maloval jsem, maloval bych.

### analysis: sk.storm.mood (Způsob sloves ve větách), classify, 16 položek

- urči mood: «Plav» rychle ke břehu
  volby: způsob oznamovací | způsob rozkazovací | způsob podmiňovací · správně: způsob rozkazovací
  nápověda: Sloveso oznamuje (maluje), rozkazuje (maluj!), nebo říká, co by se stalo (maloval by)?
- urči mood: «Hledej» perlu pod velkým kamenem
  volby: způsob oznamovací | způsob rozkazovací | způsob podmiňovací · správně: způsob rozkazovací
  nápověda: Sloveso oznamuje (maluje), rozkazuje (maluj!), nebo říká, co by se stalo (maloval by)?
- urči mood: «Potápěj» se opatrně
  volby: způsob oznamovací | způsob rozkazovací | způsob podmiňovací · správně: způsob rozkazovací
  nápověda: Sloveso oznamuje (maluje), rozkazuje (maluj!), nebo říká, co by se stalo (maloval by)?
- urči mood: «Koupal» jsem se v moři
  volby: způsob oznamovací | způsob rozkazovací | způsob podmiňovací · správně: způsob oznamovací
  nápověda: Sloveso oznamuje (maluje), rozkazuje (maluj!), nebo říká, co by se stalo (maloval by)?
- urči mood: Delfín «skočí» do vody
  volby: způsob oznamovací | způsob rozkazovací | způsob podmiňovací · správně: způsob oznamovací
  nápověda: Sloveso oznamuje (maluje), rozkazuje (maluj!), nebo říká, co by se stalo (maloval by)?
  ⚠ tvar «skočí» mají buňky pres3, pres6: rozhodne věta?

### analysis: sk.kraken.clauses (Věta jednoduchá, nebo souvětí?), viz výše

### word-shell: sk.moon.shell-all (Ulita slov: celá stavba)

### memory-match: sk.trench.pairs-all (Pexeso: všech 14 vzorů)

## kraken-abyss.monster: Krakatice Inkoustová

### battle: viz battles.md
