param([string]$RepositoryRoot = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class PreviewWordMark { public double seconds; public int start; public int count; }
public static class PreviewNarrator {
  public static PreviewWordMark[] Speak(string text, string output, string voice, int rate) {
    var marks = new List<PreviewWordMark>();
    using (var synth = new SpeechSynthesizer()) {
      synth.SelectVoice(voice); synth.Rate = rate; synth.SetOutputToWaveFile(output, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
      synth.SpeakProgress += (sender,e) => { lock(marks) { marks.Add(new PreviewWordMark { seconds=e.AudioPosition.TotalSeconds, start=e.CharacterPosition, count=e.CharacterCount }); } };
      synth.Speak(text); synth.SetOutputToNull();
    }
    return marks.ToArray();
  }
}
"@
$plan=Get-Content -Raw (Join-Path $RepositoryRoot 'submission/goal-007/free-publication/narration-plan.json') | ConvertFrom-Json
$output=Join-Path $RepositoryRoot '.validation/goal-007-free-media/narration'
New-Item -ItemType Directory -Force -Path $output | Out-Null
foreach($segment in $plan.segments | Where-Object { $_.id -in @('briefing','home','architecture','availability') }) {
  if (Test-Path (Join-Path $output ($segment.id+'.wav'))) { throw 'Preserve existing narration; choose a new work directory.' }
  $marks=[PreviewNarrator]::Speak($segment.narration,(Join-Path $output ($segment.id+'.wav')),$plan.narration.voice,$plan.narration.rate)
  $json=ConvertTo-Json -InputObject @($marks) -Depth 4
  [IO.File]::WriteAllText((Join-Path $output ($segment.id+'.words.json')),$json+"`n",[Text.UTF8Encoding]::new($false))
}
