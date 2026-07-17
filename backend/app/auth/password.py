from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    print("HASH PASSWORD:", password)
    print("HASH LENGTH:", len(password))
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    print("=" * 80)
    print("VERIFY CALLED")
    print("PLAIN PASSWORD:", repr(plain_password))
    print("PLAIN PASSWORD LENGTH:", len(plain_password))
    print("HASHED PASSWORD:", hashed_password)
    print("=" * 80)

    return pwd_context.verify(plain_password, hashed_password)