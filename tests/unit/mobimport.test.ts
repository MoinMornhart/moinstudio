import { describe, expect, it } from 'vitest'
import { ausJava, EINGEBAUT, wandle } from '../../src/main/thumbnail/mobimport'

describe('Mob-Import: eingebaute Geometrien aus Java-Modellen', () => {
  it('rechnet Java-Teile in Bedrock-Knochen um (x und y gespiegelt, Drehung um x und y mit anderem Vorzeichen)', () => {
    const [k] = ausJava([{ name: 'bottom', versatz: [0, 3, 1], drehung: [90, 0, 0], uv: [0, 0], wuerfel: [[-14, -9, -3, 28, 16, 3]] }], 6)
    expect(k).toEqual({ name: 'bottom', pivot: [0, 3, 1], rotation: [-90, 0, 0], cubes: [{ origin: [-14, -4, -2], size: [28, 16, 3], uv: [0, 0] }] })
  })

  it('hängt alle Teile an eine gemeinsame Wurzel, wenn der Renderer das Modell dreht', () => {
    const k = ausJava([{ name: 'left', versatz: [0, 4, 9], uv: [0, 43], wuerfel: [[-14, -7, -1, 28, 6, 2]] }], 6, 90)
    expect(k[0]).toEqual({ name: 'root', pivot: [0, 0, 0], rotation: [0, 90, 0] })
    expect(k[1]).toMatchObject({ name: 'left', parent: 'root', pivot: [0, 2, 9], cubes: [{ origin: [-14, 3, 8] }] })
  })

  it('liefert ein echtes Boot (Boden, vier Wände, zwei Ruder) mit der 128×64-Textur', () => {
    const boot = EINGEBAUT['geometry.boat']!
    expect(boot.tex).toEqual([128, 64])
    const { parts } = wandle(boot)
    expect(parts.map((p) => p.name)).toEqual(['root', 'bottom', 'back', 'front', 'right', 'left', 'left_paddle', 'right_paddle'])
    expect(parts.find((p) => p.name === 'left_paddle')!.boxes).toHaveLength(2)
  })
})
