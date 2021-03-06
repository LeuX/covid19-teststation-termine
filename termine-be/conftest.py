import logging
import sys
from base64 import b64encode

import hug
import pytest

from access_control.access_control import UserRoles
from db import model
from db.directives import PeeweeContext

USER = "user"
ADMIN = "admin"
INVALID = "invalid"

FORMAT = '%(asctime)s - %(levelname)s\t%(name)s: %(message)s'
logging.basicConfig(format=FORMAT, stream=sys.stdout, level=logging.INFO)
log = logging.getLogger('conftest')


def get_auth_header(user, pw):
    return {"Authorization": get_basic_auth(user, pw)}


def get_basic_auth(user, pw):
    return "Basic " + b64encode(f"{user}:{pw}".encode("utf-8")).decode('utf-8')


def get_invalid_login():
    return get_auth_header(INVALID, INVALID)


def get_user_login():
    return get_auth_header(USER, USER)


def get_admin_login():
    return get_auth_header(ADMIN, ADMIN)


@pytest.yield_fixture
def testing_db():
    PeeweeContext.set_testing()
    pwc = PeeweeContext()
    if pwc.db.database == ':memory:':
        with pwc.db.atomic():
            hug.test.cli("init_db", for_real=True, module='main')
            hug.test.cli("add_user", ADMIN, password=ADMIN, role=UserRoles.ADMIN, module='main')
            hug.test.cli("add_user", USER, password=USER, role=UserRoles.USER, module='main')
            log.info('in-mem test db setup done')
            yield pwc.db
            log.info('tearing down in-mem test db')
            pwc.db.drop_tables(model.tables)
    else:
        pytest.fail("these tests should only run against in-mem db!")
