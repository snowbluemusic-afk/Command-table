#!/usr/bin/env python3
"""Validate the EXACT upstream Forge card data embedded in this Android APK.

This checks the scripting/packaging contract across many mechanics; it is
NOT a game-resolving simulator. See docs/SOL_POD_RULES_VALIDATION_MATRIX_v040.md
for deterministic Java end-to-end cases which still require engine replay.
"""
from __future__ import annotations
import io, math, sys, zipfile
from pathlib import Path

path=Path(sys.argv[1] if len(sys.argv)>1 else
 '/tmp/forge/forge-gui-android/assets/command-table-forge-resources.zip')
with zipfile.ZipFile(path) as package:
    packed=package.read('res/cardsfolder/cardsfolder.zip')
with zipfile.ZipFile(io.BytesIO(packed)) as cards:
    all_files=set(cards.namelist())
    def card(name):
        filename=name[0].lower()+'/'+name.lower().replace(' ','_').replace(',','').replace("'","")+'.txt'
        if filename not in all_files:
            raise AssertionError(f'Missing card script: {filename}')
        return cards.read(filename).decode('utf-8')
    required={
      'Bruvac the Grandiloquent':['R:Event$ Mill','ValidPlayer$ Player.Opponent',
        'ReplaceWith$ MillTwice','ReplaceCount$Number/Twice'],
      'Maddening Cacophony':['K:Kicker:3 U','RepeatPlayers$ Player.Opponent',
        'NumCards$ Y','HalfUp'],
      'Cut Your Losses':['K:Casualty:2','ValidTgts$ Player','HalfDown'],
      'Traumatize':['ValidTgts$ Player','HalfDown'],
      'Fleet Swallower':['T:Mode$ Attacks','ValidTgts$ Player','HalfUp'],
      'Fractured Sanity':['K:Cycling:1 U','T:Mode$ Cycled','NumCards$ 4'],
      'Panharmonicon':['S:Mode$ Panharmonicon','ValidCause$ Artifact,Creature'],
      'Solemn Simulacrum':['Destination$ Battlefield','Destination$ Graveyard','DB$ Draw'],
      'Anointed Procession':['R:Event$ CreateToken','ReplaceWith$ DoubleToken'],
      'Rest in Peace':['R:Event$ Moved','Destination$ Graveyard','Destination$ Exile'],
      'Torbran, Thane of Red Fell':['R:Event$ DamageDone','ReplaceCount$DamageAmount/Plus.2'],
      'Rhystic Study':['T:Mode$ SpellCast','UnlessCost$ 1'],
      'Smothering Tithe':['T:Mode$ Drawn','UnlessCost$ 2']
    }
    for name,tokens in required.items():
        text=card(name)
        for token in tokens:
            assert token in text, f'{name}: missing Forge script rule: {token}'
        print('Forge card data OK:',name)
    # Reference results from Comprehensive Rules; NOT executable Forge
    # engine assertions. The goal is to catch incorrect test expectations.
    for n in (0,1,2,39,40,41,42,97):
        kicked=min(n,2*math.ceil(n/2))
        half_down=min(n,2*(n//2))
        assert kicked==n,('Bruvac + kicked Cacophony',n,kicked)
        assert half_down==n-n%2,('Bruvac + Cut Your Losses',n,half_down)
    print('Reference rounding fixtures OK for N=0,1,2,39,40,41,42,97')
    print('PASS v0.40: 13 embedded Forge card rule scripts and reference fixtures verified; not a game-engine replay')
