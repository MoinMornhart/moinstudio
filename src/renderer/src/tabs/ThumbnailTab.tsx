import { Card, PageHeader } from '../components/Panel'

/** Thumbnail-Reiter: wird nach dem Neustart (28.09.2026) von Grund auf neu gebaut. */
export function ThumbnailTab(): React.JSX.Element {
  return (
    <>
      <PageHeader title="Thumbnail" subtitle="Thumbnails im Stil der großen Minecraft-Kanäle – wird gerade von Grund auf neu gebaut." />
      <Card title="Neues Thumbnail" badge="im Neuaufbau">
        <p className="muted">Hier entsteht die neue Thumbnail-Erstellung: Beschreibung oder Video hochladen, Claude plant, Blender rendert.</p>
      </Card>
    </>
  )
}
