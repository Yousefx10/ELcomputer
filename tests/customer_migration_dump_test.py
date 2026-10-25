import importlib.util, io, pathlib, unittest
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dump',root/'scripts/customer-migration/wordpress_dump.py');dump=importlib.util.module_from_spec(spec);spec.loader.exec_module(dump)
class DumpSafety(unittest.TestCase):
 def test_values_and_injection_refusal(self):
  self.assertEqual(list(dump.values(b"(1,'a\\'b',NULL,'Arabic')")),[['1',"a'b",None,'Arabic']])
  with self.assertRaises(ValueError):list(dump.values(b"(1,'safe');DROP TABLE users;"))
 def test_exact_prefix_and_hash_removal(self):
  raw=b"CREATE TABLE `wp_users` (\n  `ID` bigint,\n  `user_email` text,\n  `user_pass` text,\n  `user_activation_key` text\n);\nINSERT INTO `wp_users` VALUES (1,'a@example.test','$wp$2y$fixture','secret');\nCREATE TABLE `wp_plugin_users` (\n  `id` bigint\n);\nINSERT INTO `wp_plugin_users` VALUES (999);\n"
  result=dump.extract(io.BytesIO(raw),'wp_');self.assertEqual(result['counts']['users'],1)
  self.assertNotIn('user_pass',result['tables']['users'][0]);self.assertNotIn('user_activation_key',result['tables']['users'][0])
  self.assertEqual(result['password_hash_types'],{'wordpress_bcrypt_sha384':1})
 def test_serialized_objects_are_never_executed(self):
  self.assertEqual(dump.php_array('a:1:{s:6:"status";s:4:"sent";}'),{'status':'sent'})
  with self.assertRaises(ValueError):dump.php_array('O:4:"Evil":0:{}')
if __name__=='__main__':unittest.main()
