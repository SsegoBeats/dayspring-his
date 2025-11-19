import re
text=open('lib/security.ts').read()
for match in re.finditer(r'documents: \[(.*?)\]', text, re.S):
    print(match.start(), match.group(0))
