name: Proposta funzionale / Feature request
description: Suggerisci un miglioramento o un nuovo parser exchange / Suggest an enhancement or exchange parser
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problema / Problem
      description: Quale limite o attrito stai riscontrando? / What limitation or friction are you experiencing?
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Soluzione proposta / Proposed solution
      description: Come dovrebbe funzionare? / How should it behave?
    validations:
      required: true
