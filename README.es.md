# gxkb-toolkit

Herramientas modernas para Knowledge Bases de GeneXus — Git, IDEs, tests y asistentes de IA donde GeneXus no ofrece ninguno de los tres.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/OWNER/gxkb-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/gxkb-toolkit/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

English: [README.md](./README.md)

## El problema

GeneXus guarda una aplicación entera — Transactions, Procedures, WebPanels, reglas de negocio,
código de eventos — dentro de una Knowledge Base opaca. No hay un archivo por objeto en disco
al que apuntar un IDE normal, no hay `git diff` granular, no hay forma de correr una suite de
tests sobre esa lógica, y no hay forma de apuntar un asistente de IA a "el código" — porque
fuera de GeneXus mismo, no existe como tal. Los exports `.xpz` son la única vía de escape, y son
un único bloque XML denso, no un proyecto. Este toolkit convierte ese bloque en uno.

## Herramientas

| Herramienta | Qué hace | Estado | |
|---|---|---|---|
| [`xpz-extract`](./packages/xpz-extract) | Parsea un export `.xpz` de una Knowledge Base y lo reconstruye como un proyecto de código navegable, apto para Git | **Stable** | [→](./packages/xpz-extract) |
| [`folio-solver`](./packages/folio-solver) | Triage asistido por IA: dado un folio de soporte y un manifest de `xpz-extract`, sugiere qué objetos modificar y genera un `.xpz` importable | **Experimental** | [→](./packages/folio-solver) |

## Quick start

```bash
git clone https://github.com/OWNER/gxkb-toolkit.git
cd gxkb-toolkit
pnpm install
pnpm --filter xpz-extract run build

# Extrae la KB sintética de ejemplo incluida en fixtures/
node packages/xpz-extract/dist/cli.js extract \
  packages/xpz-extract/fixtures/sample-gx18.xpz \
  -o kb-extracted

ls kb-extracted/objects/Transaction   # Customer.md
cat kb-extracted/AI_INSTRUCTIONS.md   # qué pasarle a un asistente de IA
```

También podés correrlo desde el código fuente con `npx tsx` durante desarrollo — ver
[`packages/xpz-extract/README.md`](./packages/xpz-extract/README.md) para todas las formas de
instalarlo.

## Cómo encajan las herramientas

```mermaid
flowchart LR
  KB[Knowledge Base GeneXus] -->|Export| XPZ[archivo .xpz]
  XPZ --> Extract[xpz-extract]
  Extract --> Project[Proyecto de código navegable]
  Project --> IDE[IDE]
  Project --> Git[Git / GitHub]
  Project --> Tests[Tests automatizados]
  Project --> Agent[Asistente de IA]
  Project -.manifest.json.-> Folio[folio-solver — experimental]
  Ticket[Folio de soporte] --> Folio
  Folio -.genera.-> NewXpz[.xpz con el cambio propuesto]
  NewXpz -.importar.-> KB
```

`xpz-extract` es la base sobre la que se apoyan ambas herramientas y todo flujo posterior.
`folio-solver` consume su salida; no vuelve a parsear archivos `.xpz` por su cuenta. Ver
[`docs/architecture.md`](./docs/architecture.md) para el detalle de cómo se relacionan los dos
paquetes.

## Cómo funciona

`xpz-extract` corre un pipeline de tres etapas (ver [`docs/xpz-format.md`](./docs/xpz-format.md)
para la referencia completa del formato):

1. **Descomprimir** — un `.xpz` es un archivo ZIP; cada entrada se decodifica según su encoding
   XML declarado (los exports de GeneXus suelen venir en `iso-8859-1`/`windows-1252`, no UTF-8).
2. **Parsear** — los exports de GeneXus vienen en dos formatos XML incompatibles que hay que
   manejar por igual: **GX9** (`<ExportFile><GXObject>`, denso en CDATA) y **GX18**
   (`<KBObject>`, basado en atributos). El formato se detecta automáticamente por archivo. Las
   secciones de layout web de GX9 se eliminan antes de parsear — habitualmente son 60-80% del
   tamaño del archivo y están llenas de entidades HTML sueltas que rompen los parsers XML.
3. **Clasificar y escribir** — cada objeto se normaliza a una sola forma (atributos, reglas,
   eventos, parámetros, código fuente) sin importar de qué formato vino, y se renderiza como un
   archivo Markdown por objeto más un `manifest.json` con los mismos datos en JSON estructurado.

## Limitaciones

Leer esto antes de confiar en la salida sobre una KB real:

- **Tipos de objeto cubiertos**: Transaction, Procedure, WebPanel, WorkPanel, Report, SDT,
  DataProvider, Table, Domain, BusinessComponent, ExternalObject, WebService, Module. Cualquier
  otro tipo cae en un bucket genérico `Other` con solo su nombre/descripción.
- **No infiere foreign keys entre objetos.** GeneXus infiere FKs implícitamente (reutilizando el
  nombre del atributo PK de otra Transaction), pero `xpz-extract` todavía no calcula esto — los
  atributos de cada objeto se reportan tal como están declarados, sin cruzarlos entre sí.
- **`References` es heurístico**, extraído por regex sobre patrones `Call()`, `Udp()`, `new X()`,
  `For Each X` y `Do 'X'`. Es una ayuda para navegar, no un grafo de dependencias verificado.
- **Exports muy grandes (100+ MB)** se parsean íntegramente en memoria; todavía no hay un modo
  de streaming (ver Roadmap).
- **`folio-solver` es explícitamente experimental** — leer su propio README antes de usarlo sobre
  algo que importe.
- Probado contra exports de **GeneXus 9 y GeneXus 18**. Variantes de formato más viejas o más
  nuevas pueden necesitar ajustes en la detección de formato del parser.

## Roadmap

- [ ] Extracción por streaming para exports `.xpz` muy grandes (100+ MB)
- [ ] Inferencia de foreign keys entre objetos en el manifest
- [ ] Un modo `--diff`: comparar dos extracciones de la misma KB en distintas fechas de export
- [ ] Ampliar la cobertura de tests validados de `folio-solver` hacia un estado "beta"
- [ ] Tipos de objeto adicionales (objetos generados por Patterns, Themes) en el clasificador

## Este toolkit es genérico

Ambos paquetes son herramientas agnósticas de cliente, **sin código propietario, nombres de
clientes ni datos de producción** en ningún lugar de este repositorio. Todos los fixtures bajo
`packages/xpz-extract/fixtures/` son una Knowledge Base sintética (`Customer` /
`GetCustomerBalance` / `CustomerList`) escrita para este proyecto — no exportada de ninguna KB
real. Nada acá requiere acceso al entorno GeneXus de una organización específica para compilar,
testear o usar.

## Licencia

[MIT](./LICENSE)
