import os, sys
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "scripts"))   # enables `from reports import ...`
sys.path.insert(0, os.path.join(_ROOT, "core"))      # enables `import ytcore` if a test needs it
