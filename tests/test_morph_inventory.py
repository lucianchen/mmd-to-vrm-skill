import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from morph_inventory import importer_storage_keys, SDEF_STORAGE_KEYS


class MorphInventoryTest(unittest.TestCase):
    def test_complete_sdef_storage_is_not_an_authored_expression(self):
        authored = ['blink', 'mouth', 'group']
        imported = ['blink', 'mouth', *SDEF_STORAGE_KEYS]
        self.assertEqual(importer_storage_keys(authored, imported), sorted(SDEF_STORAGE_KEYS))

    def test_ordinary_model_and_unimported_groups_need_no_removal(self):
        self.assertEqual(importer_storage_keys(['blink', 'group'], ['blink']), [])

    def test_authored_reserved_name_is_not_silently_removed(self):
        with self.assertRaisesRegex(ValueError, 'collide'):
            importer_storage_keys(['mmd_sdef_c'], SDEF_STORAGE_KEYS)

    def test_unknown_extra_requires_review(self):
        with self.assertRaisesRegex(ValueError, 'Unclassified'):
            importer_storage_keys(['blink'], ['blink', 'unrecognized_helper'])

    def test_incomplete_storage_set_requires_review(self):
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            importer_storage_keys(['blink'], ['blink', 'mmd_sdef_c'])


if __name__ == '__main__':
    unittest.main()
