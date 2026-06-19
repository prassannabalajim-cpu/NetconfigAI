import os

directory = 'app/api/v1'

for filename in os.listdir(directory):
    if filename.endswith(".py"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as file:
            filedata = file.read()

        # Simple replacements
        filedata = filedata.replace('from app.services.auth_service import get_current_active_user', 'from app.core.auth_dependencies import get_current_active_user')
        filedata = filedata.replace('from app.services.auth_service import get_current_active_user, require_role', 'from app.core.auth_dependencies import get_current_active_user\nfrom app.core.role_guard import RoleGuard')
        filedata = filedata.replace('require_role', 'RoleGuard')

        with open(filepath, 'w') as file:
            file.write(filedata)
