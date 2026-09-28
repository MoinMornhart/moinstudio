import { Card, PageHeader } from '../components/Panel'

/** Schnitt-Reiter: wird nach dem Neustart (28.09.2026) neu gebaut. */
export function SchnittTab(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Schnitt" subtitle="Rohvideo rein, fertiges Video raus – kommt nach dem Thumbnail-Neuaufbau." />
      <Card title="Projekte" badge="kommt später">
        <p className="muted">Der Schnitt wird neu aufgebaut, sobald die Thumbnails stehen.</p>
      </Card>
    </>
  )
}
