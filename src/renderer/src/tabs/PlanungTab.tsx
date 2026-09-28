import { Card, PageHeader } from '../components/Panel'

const COLUMNS = ['Idee', 'Aufnahme', 'Schnitt', 'Thumbnail', 'Upload', 'Veröffentlicht']

export function PlanungTab(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Planung" subtitle="Boards für MoinMornhart und MoinMorni – von der Idee bis zum Upload." />
      <Card title="MoinMornhart" badge="kommt in 0.8.0">
        <div className="board">
          {COLUMNS.map((c) => (
            <div key={c} className="board-col">
              <div className="board-col-head">{c}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
