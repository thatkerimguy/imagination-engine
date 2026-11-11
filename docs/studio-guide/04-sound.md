# 4. Sound

**Sound** has three tabs: **Music**, **Sound effects** and **Setup**.

## Music

### Adding songs

- **Import a file**: an audio file from your computer or phone. It's kept with the novel on
  this device.
- **Find music**: search free catalogues by mood, genre or title.
  - **Openverse** — Creative Commons audio from Jamendo, Freesound and Wikimedia. No account.
  - **Audius** — free streaming with credit to the artist; each artist sets their terms.
  - **Jamendo** — Creative Commons music. Needs a free client ID from devportal.jamendo.com.

  **Listen** previews a result, and its licence badge tells you whether you can publish it:
  _free to publish_, _publish with credit_, _check the licence_, or _private use only_.

- **Spotify or YouTube link**: paste a track or video link. These are for your own
  playthroughs only. Spotify needs Premium and a sign-in under **Setup**. A public novel
  can't use them, but you can give them a public replacement in Publish.

### Beats

Rhythm fights, sequences and beat-synced effects need to know where the beats are.

- Imported and catalogue songs are **analysed on their own**: tempo (BPM), beats, bars, key and
  sections. The strip under a song shows the beats and bars. **Play with beats** with **Click on
  beats** on lets you hear whether they line up.
- **Analyse with Beat This!** re-does it with a neural beat tracker, which is more accurate.
  Download its model once under **Setup**. It suits a computer; the beats it finds are saved in
  the novel, so phones and readers never run it.
- **Tap along** (Spotify/YouTube songs, or when analysis is wrong): press **Play and tap
  along**, tap on a downbeat (the "one"), then on every beat for a few bars. Set **Beats per
  bar** and press **Use N BPM**.

### Drum hits (stem separation)

Under **Setup → Drum hits**, the Studio can split each song to hear its drums on their own and
save where every hit lands. Fights and effects can then follow the real drums instead of a plain
beat grid.

- It downloads a large model, and takes a few minutes per song on a computer with a good
  graphics card.
- **Find drum hits** does every analysed song that doesn't have them yet.
- Phones can't run it, but they use the hits a computer found, because the hits travel with
  the novel.

### Music in the story: the Music block

**Music** block: "Play _track_ with a _N_ s crossfade". Pick **silence** to fade the music out.
**Preview** plays it in place.

## Sound effects

The **Sound effects** tab is a small synthesiser for game-like sounds (no files needed).

1. **New sound**, then start from a preset:
   - arcade: Pickup, Laser, Explosion, Power-up, Hit, Jump, Blip, Random;
   - story sounds: Coin, Click, Door knock, Footstep, Heartbeat, Alarm, Magic, Thunder, Splash,
     Whoosh.
2. Shape it with the sliders: **Wave** (square, saw, sine, noise), **Pitch**, **Pitch slide**,
   **Attack**, **Sustain**, **Punch**, **Decay**, **Vibrato**, **Repeat**, **Brightness**,
   **Thinness**, **Volume**.
3. **Vary** makes a slightly different version of the same sound. **Play** to hear it.
4. Name it.

In the story, a **Sound effect** block plays it. **Add in Sound…** jumps here if you have none yet.

## Ambience

The **Ambience** block fades a background layer — **rain**, **wind**, **room tone**, **crowd**
or **fire** — to a volume over some seconds. Set volume 0 (**off**) to fade it out. Several
layers can play together.

## Character voices

Set on each character in **Data → Characters → Voice** (chapter 3): typewriter blips as their
lines appear.

## Setup

- **Tap timing**: tap along to twelve clicks so rhythm fights allow for how late this device
  notices a tap. Do it once on each device, especially the phone with Bluetooth headphones.
- **Spotify**: for your own playthroughs; needs Premium. Create an app on
  developer.spotify.com, add the redirect address shown as its redirect URI, enter its client
  ID, and **Sign in to Spotify**.
- **Beat This!**: download or remove the model. **Analyse them now** re-analyses every song
  whose beats could be better.
- **Drum hits**: see above.

## Readers' control

Readers have their own volume sliders in the Player for everything, music, ambience, sound
effects and voices, so mix your sounds at a sensible level and let them adjust.
