import re
import ast

def fix(html):
    hallucination_match = re.search(r'\{[\s\n]*"?(shots|offsetSeconds|inTime)"?\s*:', html)
    if hallucination_match:
        # Check if there is a nested "html" key inside this hallucination
        nested_html_matches = list(re.finditer(r'"html"\s*:\s*("(?:\\.|[^"\\])*")', html[hallucination_match.start():]))
        if nested_html_matches:
            nested_parts = []
            for m in nested_html_matches:
                try:
                    nested_parts.append(ast.literal_eval(m.group(1)))
                except Exception:
                    try:
                        val = m.group(1)[1:]
                        if val.endswith('"'): val = val[:-1]
                        val = val.replace('\\"', '"').replace('\\n', '\n')
                        nested_parts.append(val)
                    except:
                        pass
            
            if nested_parts:
                print("FOUND NESTED HTML")
                return "\n<!-- SHOT SPLIT -->\n".join(nested_parts)
            
        print("NO NESTED HTML FOUND, TRUNCATING")
        return html[:hallucination_match.start()].strip()
    return html

test_str = """<style>
@import url('...');
</style>{
  "shots": [
    {
      "offsetSeconds": 0,
      "html": "<style>real</style><h1>Hello</h1>"
    }
  ]
}"""

test_str2 = """<style>
@import url('...');
</style>{
  "shots": [
    {
      "offsetSeconds": 0,
      "html": "<style>real</style><h1>Hello</h1><svg><defs><marker id=\\\"arrow"""

print("Test 1:")
print(fix(test_str))
print("\nTest 2:")
print(fix(test_str2))
