import re

def clean(html):
    # Step 1: Check for hallucinated JSON nesting
    hallucination_match = re.search(r'\{[\s\n]*"?(shots|offsetSeconds|inTime)"?\s*:', html)
    if hallucination_match:
        idx = hallucination_match.start()
        
        # Match ' "html" : " '
        nested_matches = list(re.finditer(r'"html"\s*:\s*\"', html[idx:]))
        if nested_matches:
            nested_parts = []
            for m in nested_matches:
                start_str = idx + m.end()
                
                # find the end of the string
                end_str = start_str
                escaped = False
                while end_str < len(html):
                    if escaped:
                        escaped = False
                    elif html[end_str] == '\\':
                        escaped = True
                    elif html[end_str] == '"':
                        break
                    end_str += 1
                
                val = html[start_str:end_str]
                # Unescape
                val = val.replace('\\"', '"').replace('\\n', '\n')
                nested_parts.append(val)
            
            if nested_parts:
                extracted = "\n<!-- SHOT SPLIT -->\n".join(nested_parts)
                # Need to run clean recursively to drop any trailing hallucinations of the REAL html!
                return clean(extracted)
                
        # If no "html" key was found, then it's just raw garbage to truncate
        html = html[:idx].strip()
        
    return html

test = """<style>
@import url('...');
</style>{\n  "shots": [
    {
      "offsetSeconds": 0,
      "html": "<style>real</style><h1>Hello</h1><svg><defs><marker id=\\\"arrow\" \n"
"""
print(clean(test))
