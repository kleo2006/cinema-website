#!/usr/bin/env bash
# Generates the synthetic test film used by the browser tests (e2e/fixtures/media).
# The picture and sound are produced by ffmpeg's built-in generators (testsrc + sine), so there is no third-party
# content and nothing to license. 180 s long on purpose: Cinema ignores positions < 30 s and treats the last 90 s as
# "finished", so a shorter clip could never exercise saved-progress and resume behaviour.
set -euo pipefail
cd "$(dirname "$0")/../e2e/fixtures/media"
SRC=(-f lavfi -i "testsrc=size=256x144:rate=10:duration=180" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=180")
rm -rf film.mp4 film.webm hls && mkdir -p hls
# Progressive MP4 (H.264 + AAC), moov atom first so it can start before it is fully downloaded.
ffmpeg -v error -y "${SRC[@]}" -c:v libx264 -preset veryfast -crf 36 -g 24 -pix_fmt yuv420p -c:a aac -b:a 32k -movflags +faststart film.mp4
# Progressive WebM (VP9 + Opus) - playable by open-source Chromium builds that lack H.264.
ffmpeg -v error -y "${SRC[@]}" -c:v libvpx-vp9 -b:v 0 -crf 46 -g 24 -deadline realtime -cpu-used 8 -c:a libopus -b:a 24k film.webm
# HLS (fMP4 segments, 4 s each) for hls.js / native HLS.
ffmpeg -v error -y "${SRC[@]}" -c:v libx264 -preset veryfast -crf 36 -g 48 -keyint_min 48 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -b:a 32k \
  -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 -hls_segment_filename "hls/seg_%03d.m4s" hls/master.m3u8
ls -l film.mp4 film.webm hls | head -20
# One WebVTT subtitle track (own text) so subtitle handling can be tested.
cat > en.vtt <<'VTT'
WEBVTT

00:00:00.000 --> 00:00:10.000
Cinema test film: subtitle track works.

00:00:10.000 --> 00:00:20.000
Second cue at ten seconds.
VTT
