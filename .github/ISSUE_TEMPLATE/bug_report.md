name: Segnalazione bug / Bug report
description: Segnala un malfunzionamento inatteso / Report an unexpected bug
labels: ["bug"]
body:
  - type: textarea
    id: description
    attributes:
      label: Descrizione / Description
      description: Cosa è successo e cosa ti aspettavi? / What happened and what did you expect?
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Riproduzione / Reproduction
      description: Passaggi minimi per riprodurre il problema / Minimal steps to reproduce
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Ambiente / Environment
      description: "Node.js version, OS, OS version (e.g. Node 22.18, Ubuntu 24.04)"
    validations:
      required: true
