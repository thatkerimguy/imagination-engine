/** A small original chart in .osu text form, for tests and the Studio's e2e import. */
export const SAMPLE_OSU = `osu file format v14

[General]
AudioFilename: song.mp3
AudioLeadIn: 500
PreviewTime: 1000
Mode: 0

[Metadata]
Title:Lantern Steps
TitleUnicode:Lantern Steps
Artist:Nobody
ArtistUnicode:Nobody
Creator:Tester
Version:Easy
Source:

[Difficulty]
HPDrainRate:4
CircleSize:4
OverallDifficulty:5
ApproachRate:6
SliderMultiplier:1.4
SliderTickRate:1

[Events]
//Background and Video events
0,0,"bg.jpg",0,0

[TimingPoints]
1000,500,4,2,0,60,1,0
3000,-50,4,2,0,60,0,0

[HitObjects]
256,192,1000,5,0,0:0:0:0:
356,192,1500,1,0,0:0:0:0:
100,100,2000,2,0,L|240:100,1,140
200,300,3000,6,0,B|300:300|300:200,2,140
256,192,5000,12,0,7000,0:0:0:0:
256,192,7500,5,0,0:0:0:0:
`;
