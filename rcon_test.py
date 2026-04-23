import socket
import struct

def rcon_command(host, port, password, command):
    def create_packet(id, type, body):
        body_bytes = body.encode('utf-8')
        size = len(body_bytes) + 10
        return struct.pack('<III', size, id, type) + body_bytes + b'\x00\x00'

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((host, port))
        s.send(create_packet(1, 3, password))
        s.recv(4096)
        s.send(create_packet(2, 2, command))
        return s.recv(4096)[12:-2].decode('utf-8', errors='ignore')

print(rcon_command('127.0.0.1', 27015, 'changeme', 'meta load addons/swiftlys2/bin/linuxsteamrt64/swiftlys2'))
