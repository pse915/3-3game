"""Credentials stay in Streamlit secrets, never in component arguments."""
import json, hmac, threading, gzip, base64, io
from .storage import digest, validate
class Sheets:
    def __init__(self,credentials,sheet_id):
        import gspread
        self.client=gspread.service_account_from_dict(dict(credentials),scopes=['https://www.googleapis.com/auth/spreadsheets'])
        book=self.client.open_by_key(sheet_id)
        try:self.ws=book.worksheet('checkpoints')
        except gspread.WorksheetNotFound:self.ws=book.add_worksheet('checkpoints',rows=1000,cols=4);self.ws.append_row(['id','token_hash','revision','payload'])
        self.lock=threading.Lock()
    def _rows(self,id):
        # Read once so duplicate IDs from an interrupted append are resolved
        # using the newest valid revision instead of the first matching row.
        rows=self.ws.get_all_values()
        found=[]
        for number,row in enumerate(rows,1):
            if len(row)!=4 or row[0]!=id:continue
            try:revision=int(row[2])
            except (ValueError,TypeError):continue
            if revision>=0:found.append((number,row,revision))
        return sorted(found,key=lambda item:item[2],reverse=True)
    def upsert(self,id,token_hash,revision,payload):
        if len(payload)>45000:
            payload='gzip:'+base64.b64encode(gzip.compress(payload.encode('utf-8'))).decode('ascii')
        if len(payload)>49000:raise ValueError('Cloud checkpoint too large')
        with self.lock:
            rows=self._rows(id)
            if rows:
                row,current,current_revision=rows[0]
                if not hmac.compare_digest(current[1],token_hash):raise PermissionError('Checkpoint identity conflict')
                if current_revision>=revision:return
                self.ws.update(range_name=f'A{row}:D{row}',values=[[id,token_hash,revision,payload]],value_input_option='RAW')
            else:self.ws.append_row([id,token_hash,revision,payload],value_input_option='RAW')
    def restore(self,id,token):
        with self.lock:
            for _,row,revision in self._rows(id):
                if not hmac.compare_digest(row[1],digest(token)):continue
                try:
                    payload=row[3]
                    if payload.startswith('gzip:'):
                        with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(payload[5:],validate=True))) as stream:
                            decoded=stream.read(400001)
                        if len(decoded)>400000:continue
                        payload=decoded.decode('utf-8')
                    s=json.loads(payload);s['token']=token;validate(s)
                    if s['id']!=id or s['revision']!=revision:continue
                    return s
                except (ValueError,TypeError,KeyError,OSError,EOFError):continue
            return None
