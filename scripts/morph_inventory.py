"""Separate authored PMX morphs from known MMD Tools SDEF storage keys."""

SDEF_STORAGE_KEYS = frozenset(('mmd_sdef_c', 'mmd_sdef_r0', 'mmd_sdef_r1'))


def importer_storage_keys(source_names, imported_names):
    """Return removable storage keys; refuse collisions and unknown extras."""
    source_names, imported_names = set(source_names), set(imported_names)
    collisions = source_names & SDEF_STORAGE_KEYS
    if collisions:
        raise ValueError(f'Authored morph names collide with SDEF storage: {sorted(collisions)}')
    extras = imported_names - source_names
    unknown = extras - SDEF_STORAGE_KEYS
    if unknown:
        raise ValueError(f'Unclassified imported shape keys: {sorted(unknown)}')
    if extras and extras != SDEF_STORAGE_KEYS:
        raise ValueError(f'Incomplete SDEF storage-key set: {sorted(extras)}')
    return sorted(extras)
